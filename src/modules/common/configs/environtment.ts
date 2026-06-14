 
const parseNumber = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL || 'mongodb://localhost:27017/nestjs',
    API_PORT: parseNumber(process.env.API_PORT, 3000),
    API_PREFIX: process.env.API_PREFIX || '/api/v1',
    SWAGGER_ENABLE: parseNumber(process.env.SWAGGER_ENABLE, 0),
    JWT_SECRET: process.env.JWT_SECRET || 'ThisMustBeChanged',
    JWT_ISSUER: process.env.JWT_ISSUER || 'IssuerApplication',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
    PUBLIC_FRONTEND_API_KEY: process.env.PUBLIC_FRONTEND_API_KEY || 'ThisMustBeChanged',
    HEALTH_TOKEN: process.env.HEALTH_TOKEN || 'ThisMustBeChanged',
    PASSENGERS_ALLOWED: process.env.PASSENGERS_ALLOWED || 'no',
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseNumber(process.env.REDIS_PORT, 6379),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',

    
    /** R2/MinIO: set AWS_S3_ENDPOINT and usually AWS_REGION=auto. Plain AWS: omit endpoint and set AWS_REGION (defaults to us-east-1). */
    AWS: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || (process.env.AWS_S3_ENDPOINT ? 'auto' : 'us-east-1'),
        bucket: process.env.AWS_S3_BUCKET || '',
        endpoint: process.env.AWS_S3_ENDPOINT || '', // Optional, for S3-compatible services
        publicUrl: process.env.AWS_S3_PUBLIC_URL || '',
        /** When true, omit object ACLs (avoids errors with Block Public Access on the bucket). */
        disableObjectAcl: process.env.AWS_S3_DISABLE_OBJECT_ACL === '1' || process.env.AWS_S3_DISABLE_OBJECT_ACL === 'true',
    },
};
