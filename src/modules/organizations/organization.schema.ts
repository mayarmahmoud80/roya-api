import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrgStatus } from '../common/enums/org-status.enum';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true })
export class Organization {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    ownerId: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop()
    industry: string;

    @Prop()
    website: string;

    @Prop()
    logoUrl: string;

    @Prop({ enum: Object.values(OrgStatus), default: OrgStatus.ACTIVE })
    status: OrgStatus;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
