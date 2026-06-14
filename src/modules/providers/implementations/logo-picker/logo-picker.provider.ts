import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { optionalTrimmedStringAtPort, requireTrimmedStringAtPort } from '../../../common/utils/provider-node-inputs';
import { isClearlyNonLogoImageUrl } from '../../../clients/logo-picker/logo-candidate.scoring';
import { LogoPickerService } from '../../../clients/logo-picker/logo-picker.service';
import { S3Service } from '../../../clients/s3/s3.service';
import { LOGO_PICKER_CONNECTION_CONTRACT } from '../../contracts/data-source-contracts';
import { DataSourceProvider } from '../../interfaces/data-source-provider.interface';

@Injectable()
export class LogoPickerProvider implements DataSourceProvider {
  public readonly provider = 'LogoPicker';
  private readonly logger = new Logger(LogoPickerProvider.name);

  public constructor(
    private readonly logoPickerService: LogoPickerService,
    private readonly s3Service: S3Service,
  ) {}

  public getConnectionContract() {
    return LOGO_PICKER_CONNECTION_CONTRACT;
  }

  public async execute(params: Parameters<DataSourceProvider['execute']>[0]): Promise<void> {
    const { inputs, context, requiredByDefault, config } = params;
    const strict = requiredByDefault === true;
    try {
      const html = this.extractHtml(inputs, config, strict);
      if (!html) {
        const msg = 'No HTML provided to LogoPickerProvider. Wire a WebScraper (or similar) source into the `pageHtml` port.';
        if (strict) {
          this.logger.error(msg);
          throw new Error(msg);
        }
        this.logger.warn(`LogoPickerProvider: ${msg}`);
        return;
      }

      const baseUrl = this.resolveBaseUrl(inputs, config);
      const logoUrl = await this.logoPickerService.pickLogo(html, baseUrl);
      if (!logoUrl) {
        const msg = 'No logo found';
        if (strict) {
          this.logger.error(msg);
          throw new Error(msg);
        }
        this.logger.warn(`LogoPickerProvider: ${msg}, skipping (optional data source)`);
        return;
      }

      const resolved = this.resolveLogoForUpload(logoUrl, baseUrl);
      if (resolved.kind === 'invalid') {
        const msg = 'Logo could not be resolved to a URL or inline SVG';
        this.logger.warn(`LogoPickerProvider: ${msg}`);
        if (strict) {
          throw new Error(msg);
        }
        return;
      }
      if (resolved.kind === 'http' && isClearlyNonLogoImageUrl(resolved.href)) {
        const msg = 'Resolved logo URL failed plausibility check (likely ad, tracker, or non-brand asset)';
        this.logger.warn(`LogoPickerProvider: ${msg}`);
        if (strict) {
          throw new Error(msg);
        }
        return;
      }

      const safeTarget = this.uploadFolderLabel(inputs, config);
      try {
        let uploadResult: { url: string };
        if (resolved.kind === 'svg') {
          uploadResult = await this.s3Service.uploadFile(
            resolved.buffer,
            'logo.svg',
            'image/svg+xml',
            safeTarget,
          );
        } else {
          const res = await axios.get(resolved.href, { responseType: 'arraybuffer' });
          const ext =
            (resolved.href.split('?')[0] ?? '').toLowerCase().endsWith('.svg') ||
            (res.headers['content-type'] ?? '').includes('image/svg')
              ? 'logo.svg'
              : 'logo.png';
          const mime = ext === 'logo.svg' ? 'image/svg+xml' : 'image/png';
          uploadResult = await this.s3Service.uploadFile(
            res.data,
            ext,
            mime,
            safeTarget,
          );
        }
        context.logoUrl = uploadResult.url;
      } catch (uploadOrFetchErr) {
        this.logger.warn(
          `LogoPickerProvider: fetch or S3 upload failed (${(uploadOrFetchErr as Error).message}); using text fallback if possible`,
        );
        if (strict) {
          throw uploadOrFetchErr;
        }
        if (resolved.kind === 'http') {
          context.logoUrl = resolved.href;
        } else {
          context.logoUrl = `data:image/svg+xml;charset=utf-8,${  encodeURIComponent(logoUrl)}`;
        }
      }
    } catch (error) {
      this.logger.error(error);
      if (strict) {
        throw error;
      }
    }
  }

  /**
   * `pickLogo` may return a remote image URL or inline `<svg>...</svg>` markup.
   * Candidate selection and scoring (JSON-LD, header/nav, alt/class, anti-ad/tracker heuristics) live in
   * {@link LogoPickerService} and `logo-candidate.scoring`. This class resolves URLs, blocks obvious junk
   * via {@link isClearlyNonLogoImageUrl}, and uploads to S3.
   */
  private resolveLogoForUpload(logo: string, pageUrl: string): { kind: 'http'; href: string } | { kind: 'svg'; buffer: Buffer } | { kind: 'invalid' } {
    const t = logo.trim();
    if (!t) {
      return { kind: 'invalid' };
    }
    if (t.length > 2 && t.toLowerCase().startsWith('<svg')) {
      return { kind: 'svg', buffer: Buffer.from(t, 'utf-8') };
    }
    let href: string;
    if (t.startsWith('http://') || t.startsWith('https://')) {
      href = t;
    } else if (t.startsWith('//')) {
      href = `https:${t}`;
    } else {
      try {
        href = new URL(t, pageUrl).href;
      } catch {
        return { kind: 'invalid' };
      }
    }
    try {
      return { kind: 'http', href: new URL(href).href };
    } catch {
      return { kind: 'invalid' };
    }
  }

  /** HTML from the contract `pageHtml` input port (required when strict). */
  private extractHtml(
    inputs: Record<string, unknown> | undefined,
    config: Record<string, unknown> | undefined,
    strict: boolean,
  ): string | null {
    const pageHtmlKey = LOGO_PICKER_CONNECTION_CONTRACT.inputs.pageHtml.key;
    if (strict) {
      return requireTrimmedStringAtPort(inputs, pageHtmlKey, 'LogoPicker');
    }
    const configured = config?.htmlInputKey;
    if (typeof configured === 'string' && configured.trim()) {
      const fromConfig = optionalTrimmedStringAtPort(inputs, configured.trim());
      if (fromConfig) return fromConfig;
    }
    return optionalTrimmedStringAtPort(inputs, pageHtmlKey) ?? null;
  }

  /** Base URL from contract `websiteUrl`, with legacy `config.baseUrlInputKey` override. */
  private resolveBaseUrl(inputs: Record<string, unknown> | undefined, config: Record<string, unknown> | undefined): string {
    const key = config?.baseUrlInputKey;
    if (typeof key === 'string' && key.trim()) {
      const raw = optionalTrimmedStringAtPort(inputs, key.trim());
      if (raw) {
        return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
      }
    }
    const websiteUrlKey = LOGO_PICKER_CONNECTION_CONTRACT.inputs.websiteUrl.key;
    const wiredUrl = optionalTrimmedStringAtPort(inputs, websiteUrlKey);
    if (wiredUrl) {
      return wiredUrl.startsWith('http://') || wiredUrl.startsWith('https://') ? wiredUrl : `https://${wiredUrl}`;
    }
    return 'https://example.invalid';
  }

  private uploadFolderLabel(inputs: Record<string, unknown> | undefined, config: Record<string, unknown> | undefined): string {
    const brandKey = LOGO_PICKER_CONNECTION_CONTRACT.inputs.brandName.key;
    const fromBrand = optionalTrimmedStringAtPort(inputs, brandKey);
    if (fromBrand) return fromBrand.slice(0, 200);
    const key = config?.uploadLabelInputKey;
    if (typeof key === 'string' && key.trim()) {
      const v = optionalTrimmedStringAtPort(inputs, key.trim());
      if (v) return v.slice(0, 200);
    }
    return 'logo';
  }
}
