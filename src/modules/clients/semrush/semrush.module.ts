import { Module } from '@nestjs/common';
import { SemrushService } from './semrush.service';

@Module({
    providers: [SemrushService],
    exports: [SemrushService],
})
export class SemrushModule {}
