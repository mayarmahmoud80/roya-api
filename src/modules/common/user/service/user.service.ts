import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserData, UserDocument, UserInput } from '../model';

@Injectable()
export class UserService {

    public constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>
    ) { }

    public async find(): Promise<UserData[]> {
        const users = await this.userModel.find().exec();
        return users.map(user => new UserData(user));
    }

    public async findByEmail(email: string): Promise<UserData | null> {
        const user = await this.userModel.findOne({ email }).exec();
        return user ? new UserData(user) : null;
    }

    public async create(input: UserInput): Promise<UserData> {
        const user = await this.userModel.create(input);
        return new UserData(user);
    }

}
