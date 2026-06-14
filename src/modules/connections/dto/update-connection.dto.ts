import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ConnectionStatus } from '../../common/enums/connection-status.enum';

export class UpdateConnectionDto {
    @IsString()
    @IsOptional()
    apiKey?: string;

    @IsObject()
    @IsOptional()
    config?: Record<string, any>;

    @IsEnum(ConnectionStatus)
    @IsOptional()
    status?: ConnectionStatus;
}
