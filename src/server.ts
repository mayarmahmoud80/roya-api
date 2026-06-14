import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { RoyaAppModule } from './modules/roya-app.module';
import { ResponseInterceptor } from './modules/common/interceptors/response.interceptor';
import fastifyMultipart from '@fastify/multipart';

const API_DEFAULT_PORT = 3000;
const API_DEFAULT_PREFIX = '/api/v1';

const SWAGGER_TITLE = 'Roya Plus API';
const SWAGGER_DESCRIPTION = 'Marketing Analysis SaaS Platform API';
const SWAGGER_PREFIX = '/docs';

function createSwagger(app: INestApplication) {
    const options = new DocumentBuilder()
        .setTitle(SWAGGER_TITLE)
        .setDescription(SWAGGER_DESCRIPTION)
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
        .build();

    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup(SWAGGER_PREFIX, app, document);
}

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestFastifyApplication>(
        RoyaAppModule,
        new FastifyAdapter({ logger: false }),  
    );

    await app.register(fastifyMultipart, {
        limits: { fileSize: 2 * 1024 * 1024 },
    });

    var corsOriginUrls = process.env.CORS_ORIGIN_URLS?.split(',')?.map(url => url.trim()) || '*';
    console.log(corsOriginUrls);
    app.enableCors({
        origin: corsOriginUrls,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    });

    const prefix = process.env.API_PREFIX || API_DEFAULT_PREFIX;
    app.setGlobalPrefix(prefix);

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());

    if (process.env.SWAGGER_ENABLE !== '0') {
        createSwagger(app);
    }

    const port = parseInt(process.env.API_PORT || String(API_DEFAULT_PORT), 10);
    await app.listen(port, '0.0.0.0');

    console.log(`🚀 Roya Plus API running on http://localhost:${port}${prefix}`);
    console.log(`📚 Swagger docs: http://localhost:${port}${SWAGGER_PREFIX}`);
}

bootstrap().catch(err => {
    console.error(err);
    process.exit(1);
});
