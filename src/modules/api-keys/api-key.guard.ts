import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly apiKeysService: ApiKeysService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const rawKey = request.headers['x-api-key'];

        if (!rawKey) {
            throw new UnauthorizedException('Missing x-api-key header');
        }

        try {
            const apiKey = await this.apiKeysService.validateKey(rawKey);
            request.apiKey = apiKey;
            request.user = {
                organizationId: apiKey.organizationId.toString(),
                scopedReportTypeIds: apiKey.reportTypeIds.map((r: any) => r._id?.toString() || r.toString()),
            };
            return true;
        } catch (err) {
            throw new UnauthorizedException(err.message || 'Invalid API key');
        }
    }
}
