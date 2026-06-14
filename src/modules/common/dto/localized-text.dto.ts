import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class LocalizedTextDto {
    @IsString()
    @IsNotEmpty()
    public defaultLanguage: string;

    @IsObject()
    public values: Record<string, string>;
}

