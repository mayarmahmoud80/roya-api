import { Module } from '@nestjs/common';
import { PravatarService } from './pravatar.service';

@Module({
    providers: [PravatarService],
    exports: [PravatarService],
})
export class PravatarModule {}
