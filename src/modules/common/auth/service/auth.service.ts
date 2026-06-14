import { Inject, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

import { Role, Service } from '../../../tokens';
import { Config } from '../../model';

type AuthTokenPayload = {
    sub: string;
    email: string;
    role: Role;
};

@Injectable()
export class AuthService {

    public constructor(
        @Inject(Service.CONFIG)
        private readonly config: Config
    ) { }

    public createUserToken(userId: string, email: string, role: Role): string {
        const payload: AuthTokenPayload = {
            sub: userId,
            email,
            role
        };

        return jwt.sign(payload, this.config.JWT_SECRET, {
            algorithm: 'HS256',
            issuer: this.config.JWT_ISSUER,
            expiresIn: this.config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        });
    }

}
