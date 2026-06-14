import { IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

/**
 * Options for minting an analysis embed token.
 *
 * - `ttlSeconds`: token lifetime; clamped to [60, 24*3600]. Default: 900 (15 min).
 * - `allowedOrigin`: optional origin (http(s)://host) the client expects to
 *   host the iframe. Stored in the token payload for auditing; enforcement of
 *   which origins may embed is handled by the portal's CSP frame-ancestors.
 */
export class CreateEmbedTokenDto {
    @IsOptional()
    @IsInt()
    @Min(60)
    @Max(24 * 60 * 60)
    ttlSeconds?: number;

    @IsOptional()
    @IsString()
    @IsUrl({ require_protocol: true, require_tld: false })
    allowedOrigin?: string;
}
