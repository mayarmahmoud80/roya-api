import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../common/configs/environtment';
import crypto from 'crypto';
import path from 'path';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

/** S3 object keys: avoid `://`, unescaped `/`, and other characters that break PutObject. */
function sanitizeS3KeyFolderSegment(name: string): string {
  let s = name.trim();
  s = s.replace(/^https?:\/\//i, '');
  s = s.split('/')[0] || s;
  s = s.replace(/[^a-zA-Z0-9._-]+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s.slice(0, 200) || 'media';
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;
  private bucket: string;

  private shouldSetPublicReadAcl(): boolean {
    if (config.AWS.endpoint) {
      return false;
    }
    if (config.AWS.disableObjectAcl) {
      return false;
    }
    return true;
  }

  constructor() {
    this.bucket = config.AWS.bucket;
    
    const s3Config: any = {
      region: config.AWS.region,
      credentials: {
        accessKeyId: config.AWS.accessKeyId,
        secretAccessKey: config.AWS.secretAccessKey,
      },
    };

    // Add endpoint if provided (for S3-compatible services like DigitalOcean Spaces, MinIO, etc.)
    if (config.AWS.endpoint) {
      s3Config.endpoint = config.AWS.endpoint;
      s3Config.forcePathStyle = true; // Required for some S3-compatible services
    }

    this.s3Client = new S3Client(s3Config);
    if (!this.bucket) {
      this.logger.warn('S3Service: AWS_S3_BUCKET is not set; uploads will fail until configuration is present');
    } else {
      this.logger.log(
        `S3Service: initialized (region=${config.AWS.region}, hasEndpoint=${Boolean(config.AWS.endpoint)}, hasPublicUrl=${Boolean(config.AWS.publicUrl)})`,
      );
    }
  }

  /**
   * Upload HTML content to a specific folder/filename (e.g. jobId/index.html).
   * Returns the public URL for the uploaded file.
   */
  async uploadHtml(folder: string, filename: string, content: string): Promise<UploadResult> {
    if (!this.bucket) {
     // logger.error("S3Service.uploadHtml: bucket not configured", { folder, filename });
      throw new Error('AWS S3 bucket is not configured');
    }

    const key = `roya-plus/${folder}/${filename}`;
    const body = Buffer.from(content, 'utf-8');
    //logger.debug("S3Service.uploadHtml: sending", { key, bucket: this.bucket, bodySizeBytes: body.length });

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: 'text/html; charset=utf-8',
      // No ACL for custom endpoints, when disabled, or when bucket blocks public ACLs (Block Public Access).
      ...(!this.shouldSetPublicReadAcl() ? {} : { ACL: 'public-read' as const }),
    });

    await this.s3Client.send(command);

    let url: string;
    if (config.AWS.publicUrl) {
      const publicUrl = config.AWS.publicUrl.trim();
      const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
      url = `${baseUrl}/${key}`;
    } else if (config.AWS.endpoint) {
      url = `${config.AWS.endpoint}/${this.bucket}/${key}`;
    } else {
      url = `https://${this.bucket}.s3.${config.AWS.region}.amazonaws.com/${key}`;
    }

   // logger.debug("S3Service.uploadHtml: done", { key, url, bucket: this.bucket });
    return { url, key, bucket: this.bucket };
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    file: Buffer | ArrayBuffer,
    filename: string,
    mimeType: string,
    folder: string = 'media',
  ): Promise<UploadResult> {
    if (!this.bucket) {
      this.logger.error('S3Service.uploadFile: bucket not configured');
      throw new Error('AWS S3 bucket is not configured');
    }

    const body = Buffer.isBuffer(file) ? file : Buffer.from(file as ArrayBuffer);
    const safeFolder = sanitizeS3KeyFolderSegment(folder);

    // Generate unique filename
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueFilename = `${safeFolder}/${crypto.randomUUID()}-${baseName}${ext}`;

    // Upload to S3
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: uniqueFilename,
        Body: body,
        ContentType: mimeType,
        ...(!this.shouldSetPublicReadAcl() ? {} : { ACL: 'public-read' as const }),
      },
    });

    try {
      await upload.done();
    } catch (err) {
      const e = err as Error;
      this.logger.error(`S3Service.uploadFile failed: ${e.name} ${e.message}`);
      throw err;
    }

    // Construct URL - prioritize publicUrl if configured
    let url: string;
    if (config.AWS.publicUrl) {
      // Use public URL domain if configured
      const publicUrl = config.AWS.publicUrl.trim();
      // Remove trailing slash if present
      const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
      url = `${baseUrl}/${uniqueFilename}`;
    } else if (config.AWS.endpoint) {
      // For S3-compatible services, use the endpoint
      url = `${config.AWS.endpoint}/${this.bucket}/${uniqueFilename}`;
    } else {
      // For AWS S3, use standard URL format
      url = `https://${this.bucket}.s3.${config.AWS.region}.amazonaws.com/${uniqueFilename}`;
    }

    this.logger.log(`S3Service.uploadFile: ok key=${uniqueFilename} bytes=${body.length}`);
    return {
      url,
      key: uniqueFilename,
      bucket: this.bucket,
    };
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.bucket) {
     // logger.error("S3Service.deleteFile: bucket not configured", { key });
      throw new Error('AWS S3 bucket is not configured');
    }

   // logger.debug("S3Service.deleteFile: sending", { key, bucket: this.bucket });
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
   // logger.debug("S3Service.deleteFile: done", { key });
  }

  /**
   * Get file from S3
   */
  async getFile(key: string): Promise<Buffer> {
    if (!this.bucket) {
     // logger.error("S3Service.getFile: bucket not configured", { key });
      throw new Error('AWS S3 bucket is not configured');
    }

   // logger.debug("S3Service.getFile: sending", { key, bucket: this.bucket });
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
     // logger.warn("S3Service.getFile: no body in response", { key });
      throw new Error('File not found');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
   // logger.debug("S3Service.getFile: done", { key, sizeBytes: buffer.length });
    return buffer;
  }

  /**
   * Extract S3 key from URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // Check if using publicUrl (highest priority)
      if (config.AWS.publicUrl) {
        const publicUrl = config.AWS.publicUrl.trim();
        const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
        if (url.startsWith(baseUrl)) {
          // Extract key from publicUrl format: {publicUrl}/{key}
          const key = url.substring(baseUrl.length);
          return key.startsWith('/') ? key.substring(1) : key;
        }
      }
      
      // For custom endpoint URLs: https://endpoint/bucket/key
      if (config.AWS.endpoint && url.includes(config.AWS.endpoint)) {
        const parts = url.replace(config.AWS.endpoint, '').split('/').filter(Boolean);
        if (parts.length >= 2) {
          return parts.slice(1).join('/'); // Remove bucket name, return rest
        }
      }
      
      // AWS S3 format: https://bucket.s3.region.amazonaws.com/key
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch (error) {
     // logger.debug("S3Service.extractKeyFromUrl: parse failed", { url, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase().replace('.', '');
  }

  /**
   * Determine media type from MIME type
   */
  getMediaType(mimeType: string, filename?: string): 'image' | 'video' | '3d' | 'file' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.startsWith('video/')) {
      return 'video';
    }
    if (mimeType.includes('glb') || mimeType.includes('gltf') || (filename && (filename.includes('.glb') || filename.includes('.gltf')))) {
      return '3d';
    }
    // Fallback to filename-based detection
    if (filename) {
      return getMediaTypeFromFilename(filename);
    }
    return 'file';
  }
}

// Helper function to get media type from filename (for cases where mimeType might not be available)
function getMediaTypeFromFilename(filename: string): 'image' | 'video' | '3d' | 'file' {
  const ext = path.extname(filename).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
  const modelExts = ['.glb', '.gltf'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (modelExts.includes(ext)) return '3d';
  return 'file';
}
