import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../enums/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
    @Prop({ type: Types.ObjectId, ref: 'Organization' })
    organizationId: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true, unique: true, index: true })
    email: string;

    @Prop({ required: true })
    passwordHash: string;

    @Prop({ enum: Object.values(Role), default: Role.VIEWER })
    role: Role;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    lastLoginAt: Date;

    @Prop()
    avatarUrl: string;
}

export const userSchema = SchemaFactory.createForClass(User);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ organizationId: 1 });
