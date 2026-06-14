import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class AuditFieldsService {
    forCreate(userId?: string) {
        const id = this.toObjectId(userId);
        return id ? { createdBy: id, updatedBy: id } : {};
    }

    forUpdate(userId?: string) {
        const id = this.toObjectId(userId);
        return id ? { updatedBy: id } : {};
    }

    forPublish(userId?: string) {
        const id = this.toObjectId(userId);
        return id ? { publishedBy: id, publishedAt: new Date(), updatedBy: id } : { publishedAt: new Date() };
    }

    forArchive(userId?: string) {
        const id = this.toObjectId(userId);
        return id ? { archivedBy: id, archivedAt: new Date(), updatedBy: id } : { archivedAt: new Date() };
    }

    private toObjectId(userId?: string) {
        return userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined;
    }
}

