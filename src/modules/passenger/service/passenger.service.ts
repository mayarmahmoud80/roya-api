import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Passenger, PassengerData, PassengerDocument, PassengerInput } from '../model';

@Injectable()
export class PassengerService {

    public constructor(
        @InjectModel(Passenger.name) private readonly passengerModel: Model<PassengerDocument>
    ) { }

    /**
     * Find all passengers in the database
     *
     * @returns A passenger list
     */
    public async find(): Promise<PassengerData[]> {

        const passengers = await this.passengerModel.find().exec();

        return passengers.map(passenger => new PassengerData(passenger));
    }

    /**
     * Create a new passenger record
     *
     * @param data Passenger details
     * @returns A passenger created in the database
     */
    public async create(data: PassengerInput): Promise<PassengerData> {

        const passenger = await this.passengerModel.create(data);

        return new PassengerData(passenger);
    }

}
