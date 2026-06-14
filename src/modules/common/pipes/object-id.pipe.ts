import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ObjectIdPipe implements PipeTransform<string> {
    transform(value: string): string {
        if (!Types.ObjectId.isValid(value)) {
            throw new BadRequestException(`Invalid ObjectId: ${value}`);
        }
        return value;
    }
}
