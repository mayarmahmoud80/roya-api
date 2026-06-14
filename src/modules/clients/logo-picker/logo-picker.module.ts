import { Module } from '@nestjs/common';
import { LogoPickerService } from './logo-picker.service';

@Module({
    providers: [LogoPickerService],
    exports: [LogoPickerService],
})
export class LogoPickerModule {}
