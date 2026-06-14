import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InvoiceStatus } from '../common/enums/invoice-status.enum';

export type InvoiceDocument = Invoice & Document;

@Schema({ timestamps: true })
export class Invoice {
    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    organizationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Subscription' })
    subscriptionId: Types.ObjectId;

    @Prop({ required: true })
    amount: number;

    @Prop({ default: 'USD' })
    currency: string;

    @Prop({ enum: Object.values(InvoiceStatus), default: InvoiceStatus.PENDING })
    status: InvoiceStatus;

    @Prop({ type: [{ description: String, amount: Number }], default: [] })
    items: { description: string; amount: number }[];

    @Prop({ required: true })
    issuedAt: Date;

    @Prop()
    paidAt: Date;

    @Prop()
    invoiceUrl: string;

    @Prop()
    externalInvoiceId: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
