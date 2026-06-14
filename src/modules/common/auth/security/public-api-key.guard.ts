import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { Service } from '../../../tokens';
import { Config } from '../../model';

@Injectable()
export class PublicApiKeyGuard implements CanActivate {

    public constructor(
        @Inject(Service.CONFIG)
        private readonly config: Config
    ) { }

    public canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const apiKey = request.headers['x-api-key'];

        if (typeof apiKey !== 'string') {
            return false;
        }

        return apiKey === this.config.PUBLIC_FRONTEND_API_KEY;
    }

}
