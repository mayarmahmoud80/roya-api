import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { User, UserDocument } from '../../user/model/user.schema';
import { Organization, OrganizationDocument } from '../../../organizations/organization.schema';
import { Subscription, SubscriptionDocument } from '../../../subscriptions/subscription.schema';
import { Plan, PlanDocument } from '../../../plans/plan.schema';
import { Role } from '../../enums/role.enum';
import { OrgStatus } from '../../enums/org-status.enum';
import { SubscriptionStatus } from '../../enums/subscription-status.enum';
import { PlanTier } from '../../enums/plan-tier.enum';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

@Injectable()
export class RoyaAuthService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
        @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
        @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
        private readonly jwtService: JwtService,
    ) {}

    async register(dto: RegisterDto) {
        const existing = await this.userModel.findOne({ email: dto.email }).exec();
        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        // Create placeholder user to get ID for org creation
        const user = await this.userModel.create({
            name: dto.name,
            email: dto.email,
            passwordHash,
            role: Role.OWNER,
            isActive: true,
        });

        // Create organization
        const org = await this.orgModel.create({
            ownerId: user._id,
            name: dto.organizationName,
            status: OrgStatus.ACTIVE,
        });

        // Link user to org
        await this.userModel.findByIdAndUpdate(user._id, { organizationId: org._id });

        // Find free plan and create subscription
        const freePlan = await this.planModel.findOne({ tier: PlanTier.FREE }).exec();
        if (freePlan) {
            await this.subModel.create({
                organizationId: org._id,
                planId: freePlan._id,
                status: SubscriptionStatus.ACTIVE,
                startDate: new Date(),
                autoRenew: true,
            });
        }

        const token = this.jwtService.sign({
            sub: user._id.toString(),
            email: user.email,
            role: Role.OWNER,
            organizationId: org._id.toString(),
        });

        return { token, user: { id: user._id, name: user.name, email: user.email, role: Role.OWNER } };
    }

    async login(dto: LoginDto) {
        const user = await this.userModel.findOne({ email: dto.email }).exec();
        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        await this.userModel.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

        const token = this.jwtService.sign({
            sub: user._id.toString(),
            email: user.email,
            role: user.role,
            organizationId: user.organizationId?.toString(),
            userId: user._id.toString(),
        });

        return { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } };
    }

    async getProfile(userId: string) {
        const user = await this.userModel
            .findById(userId)
            .select('-passwordHash')
            .populate('organizationId')
            .exec();
        return user;
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const existing = dto.email
            ? await this.userModel.findOne({ email: dto.email, _id: { $ne: userId } }).exec()
            : null;
        if (existing) throw new ConflictException('Email already in use');

        const updated = await this.userModel
            .findByIdAndUpdate(userId, { $set: dto }, { new: true })
            .select('-passwordHash')
            .exec();
        if (!updated) throw new NotFoundException('User not found');
        return updated;
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) throw new NotFoundException('User not found');

        const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!valid) throw new UnauthorizedException('Current password is incorrect');

        user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
        await user.save();
        return { message: 'Password changed successfully' };
    }
}
