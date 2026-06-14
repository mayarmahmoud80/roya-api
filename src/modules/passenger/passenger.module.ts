import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common';
import { PassengerController } from './controller';
import { Passenger, PassengerSchema } from './model';
import { PassengerService } from './service';

@Module({
    imports: [
        CommonModule,
        MongooseModule.forFeature([{ name: Passenger.name, schema: PassengerSchema }])
    ],
    providers: [
        PassengerService
    ],
    controllers: [
        PassengerController
    ],
    exports: []
})
export class PassengerModule { }
