export interface Config {

    readonly NODE_ENV: string;

    readonly DATABASE_URL: string;

    readonly API_PORT: number;

    readonly API_PREFIX: string;

    readonly SWAGGER_ENABLE: number;

    readonly JWT_SECRET: string;

    readonly JWT_ISSUER: string;

    readonly JWT_EXPIRES_IN: string;

    readonly PUBLIC_FRONTEND_API_KEY: string;

    readonly HEALTH_TOKEN: string;
    

    readonly AWS: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
        bucket: string;
        endpoint: string;
        publicUrl: string;
        disableObjectAcl?: boolean;
    };
    readonly PASSENGERS_ALLOWED: string;

}
