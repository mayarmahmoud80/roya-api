import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../../modules/common/user/model/user.schema';
import { Organization, OrganizationDocument } from '../../../modules/organizations/organization.schema';
import { Role } from '../../../modules/common/enums/role.enum';
import { OrgStatus } from '../../../modules/common/enums/org-status.enum';

@Injectable()
export class TenantsSeeder {
    private readonly logger = new Logger(TenantsSeeder.name);
    private static readonly DEMO_PASSWORD = 'RoyaDemo!123';

    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(Organization.name)
        private readonly organizationModel: Model<OrganizationDocument>,
    ) {}

    async seed(): Promise<OrganizationDocument> {
        const ORG_NAME = 'Roya Demo Org';
        let organization = await this.organizationModel.findOne({ name: ORG_NAME }).exec();

        const admin = await this.upsertUser({
            email: 'admin@roya.local',
            name: 'Demo Admin',
            role: Role.ADMIN,
        });

        if (!organization) {
            organization = await this.organizationModel.create({
                name: ORG_NAME,
                ownerId: admin._id,
                industry: 'Marketing Analysis',
                website: 'https://demo.roya.local',
                status: OrgStatus.ACTIVE,
            });
            this.logger.log(`Seeded Organization '${ORG_NAME}'`);
        }

        const orgId = organization._id as Types.ObjectId;

        await this.userModel.updateOne({ _id: admin._id }, { $set: { organizationId: orgId } }).exec();
        await this.upsertUser({
            email: 'viewer@roya.local',
            name: 'Demo Viewer',
            role: Role.VIEWER,
            organizationId: orgId,
        });

        return organization;
    }

    private async upsertUser(spec: {
        email: string;
        name: string;
        role: Role;
        organizationId?: Types.ObjectId;
    }): Promise<UserDocument> {
        const existing = await this.userModel.findOne({ email: spec.email }).exec();
        if (existing) {
            return existing;
        }
        const passwordHash = await bcrypt.hash(TenantsSeeder.DEMO_PASSWORD, 10);
        const created = await this.userModel.create({
            email: spec.email,
            name: spec.name,
            role: spec.role,
            passwordHash,
            isActive: true,
            ...(spec.organizationId ? { organizationId: spec.organizationId } : {}),
        });
        this.logger.log(`Seeded User '${spec.email}' (role=${spec.role})`);
        return created;
    }
}
