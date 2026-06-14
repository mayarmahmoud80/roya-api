import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
    private stripe: Stripe;

    constructor(private readonly config: ConfigService) {
        const secretKey = this.config.get<string>('STRIPE_SECRET_KEY') || 'sk_test_placeholder';
        this.stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' as any });
    }

    constructEvent(payload: string | Buffer, signature: string): Stripe.Event {
        const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') || '';
        return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    }

    async createCustomer(email: string, name: string): Promise<string> {
        const customer = await this.stripe.customers.create({ email, name });
        return customer.id;
    }

    getStripe(): Stripe {
        return this.stripe;
    }
}
