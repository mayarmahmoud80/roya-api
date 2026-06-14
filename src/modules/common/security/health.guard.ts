import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { Service } from '../../tokens';
import { Config } from '../model';

@Injectable()
export class HealthGuard implements CanActivate {

    public constructor(
        @Inject(Service.CONFIG)
        private readonly config: Config,
    ) {}

    public canActivate(context: ExecutionContext): boolean {

        const request = context.switchToHttp().getRequest<FastifyRequest>();
        return request.headers.authorization === `Bearer ${this.config.HEALTH_TOKEN}`;
    }
}
