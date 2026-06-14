import { ApiProperty } from '@nestjs/swagger';

import { PassengerDocument } from './passenger.schema';

export class PassengerData {

    public static readonly NAME_LENGTH = 50;

    @ApiProperty({ description: 'Passenger unique ID', example: '507f1f77bcf86cd799439011' })
    public readonly id: string;

    @ApiProperty({ description: 'First name', example: 'John' })
    public readonly firstName: string;

    @ApiProperty({ description: 'Last name', example: 'Doe' })
    public readonly lastName: string;

    public constructor(entity: PassengerDocument) {
        this.id = (entity._id as object).toString();
        this.firstName = entity.firstName;
        this.lastName = entity.lastName;
    }

}
