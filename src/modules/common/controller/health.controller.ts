import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { Connection } from 'mongoose';

import { HealthGuard } from '../security/health.guard';

@Controller('health')
export class HealthController {

    public constructor(
        private readonly health: HealthCheckService,
        private readonly mongoose: MongooseHealthIndicator,
        @InjectConnection() private readonly connection: Connection
    ) {}

    @Get()
    @UseGuards(HealthGuard)
    public async healthCheck() {

        return this.health.check([
            async () => this.mongoose.pingCheck('database', { connection: this.connection }),
            () => ({
                http: {
                    status: 'up',
                    uptime: process.uptime()
                }
            })
        ]);
    }

}
