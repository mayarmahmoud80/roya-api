import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PassengerDocument = Passenger & Document;

@Schema()
export class Passenger {

    @Prop({ required: true })
    public firstName: string;

    @Prop({ required: true })
    public lastName: string;

}

export const PassengerSchema = SchemaFactory.createForClass(Passenger);
