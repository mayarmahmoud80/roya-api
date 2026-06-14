import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Connection, ConnectionDocument } from './schemas/connection.schema';
import { DataSource, DataSourceDocument } from '../data-sources/data-source.schema';
import { EncryptionService } from '../common/services/encryption.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { ConnectionStatus } from '../common/enums/connection-status.enum';
import { AuthScope } from '../common/enums/auth-scope.enum';

@Injectable()
export class ConnectionsService {
    constructor(
        @InjectModel(Connection.name) private readonly model: Model<ConnectionDocument>,
        @InjectModel(DataSource.name) private readonly dataSourceModel: Model<DataSourceDocument>,
        private readonly encryptionService: EncryptionService,
    ) {}

    /**
     * Match `organizationId` whether stored as ObjectId (new rows) or String (legacy rows
     * created before the cast was enforced). Same trick for `userId` via {@link userFilter}.
     */
    private orgFilter(organizationId: string): Record<string, unknown> {
        return {
            organizationId: { $in: [new Types.ObjectId(organizationId), organizationId] },
        };
    }

    private userFilter(userId: string): Record<string, unknown> {
        return {
            userId: { $in: [new Types.ObjectId(userId), userId] },
        };
    }

    private async resolveDataSource(
        dto: CreateConnectionDto,
    ): Promise<{ dataSourceId: Types.ObjectId; providerSlug: string }> {
        if (dto.dataSourceId) {
            const dsId = new Types.ObjectId(dto.dataSourceId);
            const row = await this.dataSourceModel
                .findOne({ _id: dsId, isActive: true })
                .select('providerSlug')
                .lean()
                .exec();
            if (!row?.providerSlug) {
                throw new BadRequestException('DataSource not found or inactive');
            }
            return { dataSourceId: dsId, providerSlug: row.providerSlug };
        }
        if (dto.providerSlug) {
            const row = await this.dataSourceModel
                .findOne({
                    isActive: true,
                    $or: [{ providerSlug: dto.providerSlug }, { providerKey: dto.providerSlug }],
                })
                .select('_id providerSlug')
                .lean()
                .exec();
            if (!row?._id || !row.providerSlug) {
                throw new BadRequestException(
                    `No active data source matches provider slug "${dto.providerSlug}"`,
                );
            }
            return {
                dataSourceId: row._id as Types.ObjectId,
                providerSlug: row.providerSlug,
            };
        }
        throw new BadRequestException('dataSourceId or providerSlug is required');
    }

    /** OAuth refresh / callbacks: resolve public slug from connection row. */
    async resolveProviderSlug(connection: ConnectionDocument): Promise<string> {
        if (connection.providerSlug) {
            return connection.providerSlug;
        }
        if (!connection.dataSourceId) {
            throw new BadRequestException('Connection has no providerSlug or dataSourceId');
        }
        const row = await this.dataSourceModel
            .findById(connection.dataSourceId)
            .select('providerSlug')
            .lean()
            .exec();
        if (!row?.providerSlug) {
            throw new BadRequestException('DataSource missing providerSlug');
        }
        return row.providerSlug;
    }

    findAll(organizationId: string, userId?: string) {
        const filter: Record<string, unknown> = this.orgFilter(organizationId);
        if (userId) {
            Object.assign(filter, this.userFilter(userId));
        }
        return this.model
            .find(filter)
            .select(
                '_id dataSourceId providerSlug organizationId userId scope status lastUsedAt tokenExpiresAt lastErrorMessage',
            )
            .lean()
            .exec();
    }

    async findById(organizationId: string, id: string, userId?: string) {
        const filter: Record<string, unknown> = {
            _id: new Types.ObjectId(id),
            ...this.orgFilter(organizationId),
        };
        if (userId) {
            Object.assign(filter, this.userFilter(userId));
        }

        const item = await this.model.findOne(filter).exec();
        if (!item) throw new NotFoundException('Connection not found');
        return item;
    }

    async findByDataSource(
        organizationId: string,
        dataSourceId: string,
        userId?: string,
    ) {
        const filter: Record<string, unknown> = {
            ...this.orgFilter(organizationId),
            dataSourceId: new Types.ObjectId(dataSourceId),
            status: ConnectionStatus.ACTIVE,
        };

        if (userId) {
            Object.assign(filter, this.userFilter(userId));
            filter.scope = AuthScope.USER;
        } else {
            filter.scope = AuthScope.ORGANIZATION;
        }

        return this.model.findOne(filter).exec();
    }

    async findByProvider(organizationId: string, providerSlug: string, userId?: string) {
        // Prefer exact providerSlug match (denormalized).
        const bySlug = await this.model
            .findOne({
                ...this.orgFilter(organizationId),
                providerSlug,
                status: ConnectionStatus.ACTIVE,
                ...(userId
                    ? { ...this.userFilter(userId), scope: AuthScope.USER }
                    : { scope: AuthScope.ORGANIZATION }),
            })
            .exec();
        if (bySlug) return bySlug;

        // Fallback: match via data source catalog key
        const ds = await this.dataSourceModel
            .findOne({
                isActive: true,
                $or: [{ providerSlug }, { providerKey: providerSlug }],
            })
            .select('_id')
            .lean()
            .exec();
        if (!ds?._id) return null;

        return this.findByDataSource(organizationId, String(ds._id), userId);
    }

    async create(organizationId: string, dto: CreateConnectionDto) {
        if (dto.scope === AuthScope.USER && !dto.userId) {
            throw new BadRequestException('userId is required for user-scoped connections');
        }

        if (dto.scope === AuthScope.ORGANIZATION && dto.userId) {
            throw new BadRequestException(
                'userId should not be provided for organization-scoped connections',
            );
        }

        if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
            throw new BadRequestException('A valid organizationId is required');
        }

        const { dataSourceId, providerSlug } = await this.resolveDataSource(dto);

        // Block duplicate connection for the same datasource + scope (org or user).
        const dupFilter: Record<string, unknown> = this.orgFilter(organizationId);
        dupFilter.dataSourceId = dataSourceId;
        if (dto.userId) {
            dupFilter.userId = new Types.ObjectId(String(dto.userId));
            dupFilter.scope = AuthScope.USER;
        } else {
            dupFilter.scope = AuthScope.ORGANIZATION;
        }
        const existing = await this.model.findOne(dupFilter).select('_id').lean().exec();
        if (existing) {
            throw new ConflictException(
                'A connection already exists for this data source. Disconnect it first to reconnect.',
            );
        }

        const data: any = {
            dataSourceId,
            providerSlug,
            organizationId: new Types.ObjectId(organizationId),
            scope: dto.scope,
            config: dto.config || {},
            status: ConnectionStatus.PENDING,
        };

        if (dto.userId) {
            data.userId = new Types.ObjectId(String(dto.userId));
        }

        if (dto.apiKey) {
            data.encryptedApiKey = this.encryptionService.encrypt(dto.apiKey);
            data.status = ConnectionStatus.ACTIVE;
        }

        return this.model.create(data);
    }

    async update(organizationId: string, id: string, dto: UpdateConnectionDto, userId?: string) {
        const update: any = {};

        if (dto.apiKey) {
            update.encryptedApiKey = this.encryptionService.encrypt(dto.apiKey);
            update.status = ConnectionStatus.ACTIVE;
        }

        if (dto.config) {
            update.config = dto.config;
        }

        if (dto.status) {
            update.status = dto.status;
        }

        const filter: Record<string, unknown> = {
            _id: new Types.ObjectId(id),
            ...this.orgFilter(organizationId),
        };
        if (userId) {
            Object.assign(filter, this.userFilter(userId));
        }

        const item = await this.model
            .findOneAndUpdate(filter, { $set: update }, { new: true })
            .exec();

        if (!item) throw new NotFoundException('Connection not found');
        return item;
    }

    async updateOAuthTokens(
        connectionId: string,
        tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date; tokenType?: string },
    ) {
        const update: any = {
            oauthTokens: tokens,
            status: ConnectionStatus.ACTIVE,
        };

        if (tokens.expiresAt) {
            update.tokenExpiresAt = tokens.expiresAt;
        }

        const item = await this.model
            .findByIdAndUpdate(connectionId, { $set: update }, { new: true })
            .exec();

        if (!item) throw new NotFoundException('Connection not found');
        return item;
    }

    async markAsExpired(connectionId: string, errorMessage?: string) {
        const update: any = {
            status: ConnectionStatus.EXPIRED,
            lastErrorAt: new Date(),
        };

        if (errorMessage) {
            update.lastErrorMessage = errorMessage;
        }

        return this.model
            .findByIdAndUpdate(connectionId, { $set: update }, { new: true })
            .exec();
    }

    async updateLastUsed(connectionId: string) {
        return this.model
            .findByIdAndUpdate(connectionId, { $set: { lastUsedAt: new Date() } }, { new: true })
            .exec();
    }

    async remove(organizationId: string, id: string, userId?: string) {
        const filter: Record<string, unknown> = {
            _id: new Types.ObjectId(id),
            ...this.orgFilter(organizationId),
        };
        if (userId) {
            Object.assign(filter, this.userFilter(userId));
        }

        const item = await this.model.findOneAndDelete(filter).exec();
        if (!item) throw new NotFoundException('Connection not found');
        return { deleted: true };
    }

    decryptKey(connection: ConnectionDocument): string | null {
        if (!connection.encryptedApiKey) return null;
        return this.encryptionService.decrypt(connection.encryptedApiKey);
    }

    getAccessToken(connection: ConnectionDocument): string | null {
        return connection.oauthTokens?.accessToken || null;
    }

    isTokenExpired(connection: ConnectionDocument): boolean {
        if (!connection.tokenExpiresAt) return false;
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        return connection.tokenExpiresAt < fiveMinutesFromNow;
    }
}
