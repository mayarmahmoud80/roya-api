/**
 * One-shot seeder entry point.
 *
 * Run with:
 *     npm run seed
 *
 * Boots a standalone Nest application context (no HTTP listener) so that
 * {@link SeederService} has every Mongoose model and dependency wired up exactly as
 * the running API would, then invokes `runAll()` which:
 *   1. Upserts catalog data (data sources, builder assets, analysis types, report
 *      types, plans).
 *   2. Seeds the Brand Overview DAG sample draft and links it to the "brand"
 *      analysis type.
 *   3. Creates the demo Organization with an admin + viewer user.
 *   4. Attaches the demo org to the Pro plan subscription (30-day trial).
 *   5. Issues a demo API key (printed ONCE to stdout).
 *
 * Idempotent — safe to run repeatedly; each step skips if its target already exists.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { RoyaAppModule } from '../src/modules/roya-app.module';
import { SeederService } from '../src/database/seeder/seeder.service';

async function main(): Promise<void> {
    // `createApplicationContext` gives us full DI without spinning up Fastify / HTTP.
    const app = await NestFactory.createApplicationContext(RoyaAppModule, {
        logger: ['error', 'warn', 'log'],
    });
    try {
        const seeder = app.get(SeederService);
        await seeder.runAll();
    } finally {
        await app.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        // eslint-disable-next-line no-console
        console.error('Seeder failed:', err);
        process.exit(1);
    });
