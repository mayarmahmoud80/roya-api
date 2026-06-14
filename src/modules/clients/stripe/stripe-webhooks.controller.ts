import { Controller, Post, Req, Headers, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FastifyRequest } from 'fastify';
import { StripeService } from './stripe.service';
import { Subscription, SubscriptionDocument } from '../../subscriptions/subscription.schema';
import { Invoice, InvoiceDocument } from '../../invoices/invoice.schema';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';

@Controller('webhooks')
export class StripeWebhooksController {
    private readonly logger = new Logger(StripeWebhooksController.name);

    constructor(
        private readonly stripeService: StripeService,
        @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
        @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    ) {}

    @Post('stripe')
    async handleWebhook(
        @Req() req: FastifyRequest,
        @Headers('stripe-signature') signature: string,
    ) {
        let event: any;
        const body = (req as any).rawBody || JSON.stringify(req.body);

        try {
            event = this.stripeService.constructEvent(body, signature);
        } catch (err) {
            this.logger.error(`Stripe webhook error: ${err.message}`);
            return { received: false, error: err.message };
        }

        try {
            switch (event.type) {
                case 'customer.subscription.updated': {
                    const sub = event.data.object;
                    await this.subModel.findOneAndUpdate(
                        { externalSubId: sub.id },
                        { status: sub.status === 'active' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELLED },
                    );
                    break;
                }
                case 'customer.subscription.deleted': {
                    const sub = event.data.object;
                    await this.subModel.findOneAndUpdate(
                        { externalSubId: sub.id },
                        { status: SubscriptionStatus.CANCELLED },
                    );
                    break;
                }
                case 'invoice.payment_succeeded': {
                    const inv = event.data.object;
                    await this.invoiceModel.create({
                        amount: inv.amount_paid / 100,
                        currency: inv.currency,
                        status: InvoiceStatus.PAID,
                        issuedAt: new Date(inv.created * 1000),
                        paidAt: new Date(),
                        invoiceUrl: inv.hosted_invoice_url,
                        externalInvoiceId: inv.id,
                        items: [{ description: 'Subscription payment', amount: inv.amount_paid / 100 }],
                    });
                    break;
                }
                case 'invoice.payment_failed': {
                    const inv = event.data.object;
                    await this.invoiceModel.create({
                        amount: inv.amount_due / 100,
                        currency: inv.currency,
                        status: InvoiceStatus.FAILED,
                        issuedAt: new Date(inv.created * 1000),
                        externalInvoiceId: inv.id,
                        items: [{ description: 'Subscription payment', amount: inv.amount_due / 100 }],
                    });
                    break;
                }
                default:
                    this.logger.log(`Unhandled Stripe event: ${event.type}`);
            }
        } catch (err) {
            this.logger.error(`Error processing Stripe event: ${err.message}`);
        }

        return { received: true };
    }
}
