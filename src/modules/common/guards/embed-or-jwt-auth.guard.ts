import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface DecodedPayload {
    typ?: string;
    scope?: string;
    analysisId?: string;
    organizationId?: string;
    allowedOrigin?: string;
    sub?: string;
    [key: string]: unknown;
}

/**
 * Accepts either a normal user JWT (same behavior as {@link JwtAuthGuard}) or
 * a short-lived embed JWT minted by `POST /analyses/:id/embed-token`.
 *
 * When an embed token is used, the guard:
 *  - Populates `request.user` with an embed-scoped identity so downstream
 *    `@CurrentUser('organizationId')` still works.
 *  - Stamps `request.embed` with `{ analysisId, organizationId, allowedOrigin }`
 *    so controllers/services can pin access to exactly one analysis.
 */
@Injectable()
export class EmbedOrJwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid Authorization header');
        }

        const token = authHeader.split(' ')[1];
        const secret = this.configService.get<string>('JWT_SECRET');

        let payload: DecodedPayload;
        try {
            payload = this.jwtService.verify(token, { secret }) as DecodedPayload;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        if (payload?.typ === 'embed') {
            if (payload.scope !== 'analysis' || !payload.analysisId || !payload.organizationId) {
                throw new UnauthorizedException('Malformed embed token');
            }
            request.embed = {
                analysisId: payload.analysisId,
                organizationId: payload.organizationId,
                allowedOrigin: payload.allowedOrigin,
            };
            request.user = {
                sub: 'embed',
                organizationId: payload.organizationId,
                scopes: ['read'],
            };
            return true;
        }

        request.user = payload;
        return true;
    }
}
