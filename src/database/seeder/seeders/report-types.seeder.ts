import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportType, ReportTypeDocument } from '../../../modules/report-types/report-type.schema';
import reportTypes from '../data/report-types.json';

@Injectable()
export class ReportTypesSeeder {
    private readonly logger = new Logger(ReportTypesSeeder.name);

    constructor(
        @InjectModel(ReportType.name)
        private readonly reportTypeModel: Model<ReportTypeDocument>,
    ) {}

    async seed(): Promise<void> {
        const count = await this.reportTypeModel.countDocuments();
        if (count > 0) return;

        await this.reportTypeModel.insertMany(reportTypes);
        this.logger.log('Seeded ReportTypes');
    }
}
