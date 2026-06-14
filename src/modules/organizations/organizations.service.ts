import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

import { Organization, OrganizationDocument } from './organization.schema';
import { User, UserDocument } from '../common/user/model/user.schema';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class OrganizationsService {
    constructor(
        @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) {}

    async findByUser(organizationId: string) {
        const org = await this.orgModel.findById(organizationId).exec();
        if (!org) throw new NotFoundException('Organization not found');
        return org;
    }

    async update(organizationId: string, dto: UpdateOrganizationDto) {
        const org = await this.orgModel.findByIdAndUpdate(
            organizationId,
            { $set: dto },
            { new: true },
        ).exec();
        if (!org) throw new NotFoundException('Organization not found');
        return org;
    }

    async getMembers(organizationId: string) {
        return this.userModel
            .find({ organizationId: new Types.ObjectId(organizationId) })
            .select('-passwordHash')
            .exec();
    }

    async inviteMember(organizationId: string, dto: InviteMemberDto) {
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const user = await this.userModel.create({
            email: dto.email,
            name: dto.email.split('@')[0],
            passwordHash,
            organizationId: new Types.ObjectId(organizationId),
            role: dto.role || Role.VIEWER,
            isActive: true,
        });

        return {
            user: { id: user._id, email: user.email, role: user.role },
            tempPassword, // In production, send via email
        };
    }

    async updateMemberRole(organizationId: string, userId: string, dto: UpdateMemberRoleDto) {
        const user = await this.userModel.findOne({
            _id: new Types.ObjectId(userId),
            organizationId: new Types.ObjectId(organizationId),
        }).exec();

        if (!user) throw new NotFoundException('Member not found in organization');

        user.role = dto.role;
        await user.save();
        return user;
    }
}
