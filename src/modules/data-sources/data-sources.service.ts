import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DataSource, DataSourceDocument } from './data-source.schema';
import { Connection, ConnectionDocument } from '../connections/schemas/connection.schema';
import {
    ServiceIntegration,
    ServiceIntegrationDocument,
} from '../service-integrations/service-integration.schema';
import { DataSourceProviderRegistry } from '../providers';
import { DataSourceKind } from '../common/enums/data-source-kind.enum';
import { AuthType } from '../common/enums/auth-type.enum';
import { AuthScope } from '../common/enums/auth-scope.enum';
import { CatalogSource } from '../common/enums/catalog-source.enum';
import { ProviderCategory } from '../common/enums/provider-category.enum';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { CreateProviderDto } from '../providers-catalog/dto/create-provider.dto';
import { UpdateProviderDto } from '../providers-catalog/dto/update-provider.dto';
import { listEnabledCatalogBindings, oauthStyleCatalogFilter } from './data-sources.catalog-bindings';
import { UnifiedCatalogRow } from './data-sources.types';

@Injectable()
export class DataSourcesService {
    constructor(
        @InjectModel(DataSource.name) private readonly model: Model<DataSourceDocument>,
        @InjectModel(ServiceIntegration.name)
        private readonly integrationModel: Model<ServiceIntegrationDocument>,
        @InjectModel(Connection.name) private readonly connectionModel: Model<ConnectionDocument>,
        private readonly registry: DataSourceProviderRegistry,
    ) {}

    findAll() {
        return this.model
            .find({ isActive: true })
            .select(
                '_id name provider type kind authType baseEndpoint requiredByDefault isActive slug providerSlug providerKey catalogSource',
            )
            .sort({ name: 1 })
            .lean()
            .exec();
    }

    async findByIds(ids: string[]) {
        return this.model.find({ _id: { $in: ids } }).exec();
    }

    /** @deprecated Use {@link listPickerOptions}. */
    listProvidersForPicker() {
        return this.listPickerOptions();
    }

    async findAllCatalog(): Promise<UnifiedCatalogRow[]> {
        const [builderRows, oauthRows] = await Promise.all([
            this.model
                .find({
                    providerKey: { $exists: true, $type: 'string', $ne: '' },
                })
                .select(
                    '_id providerKey name description category implClass authType authScope icon imageUrl isActive catalogSource',
                )
                .lean()
                .exec(),
            this.model
                .find(oauthStyleCatalogFilter())
                .select(
                    '_id slug providerSlug name description category connectorClass implClass authType authScope icon imageUrl isActive catalogSource',
                )
                .sort({ name: 1 })
                .lean()
                .exec(),
        ]);

        const byKey = new Map<string, UnifiedCatalogRow>();

        for (const raw of oauthRows) {
            const row = this.normalizeUnifiedRow(raw as Record<string, unknown>);
            if (row) byKey.set(row.providerKey, row);
        }

        for (const raw of builderRows) {
            const row = this.normalizeUnifiedRow(raw as Record<string, unknown>);
            if (row) byKey.set(row.providerKey, row);
        }

        return Array.from(byKey.values()).sort((a, b) =>
            (a.displayName || a.providerKey).localeCompare(b.displayName || b.providerKey),
        );
    }

    async findOneCatalog(id: string): Promise<UnifiedCatalogRow> {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Provider not found');
        }
        const raw = await this.model.findById(id).lean().exec();
        if (!raw) {
            throw new NotFoundException('Provider not found');
        }
        const row = this.normalizeUnifiedRow(raw as unknown as Record<string, unknown>);
        if (!row) {
            throw new NotFoundException('Provider not found');
        }
        return row;
    }

    /**
     * Enabled catalog rows with an implementation class — used by {@link DataSourceProviderRegistry} on init.
     */
    async listEnabledBindings(): Promise<{ providerKey: string; implClass: string }[]> {
        return listEnabledCatalogBindings(this.model);
    }

    async listPickerOptions(): Promise<{ value: string; label: string }[]> {
        const [builderRows, oauthRows] = await Promise.all([
            this.model
                .find({
                    isActive: true,
                    implClass: { $exists: true, $ne: '' },
                    providerKey: { $exists: true, $type: 'string', $ne: '' },
                })
                .select('providerKey name')
                .sort({ name: 1 })
                .lean()
                .exec(),
            this.model
                .find({
                    isActive: { $ne: false },
                    $and: [
                        oauthStyleCatalogFilter(),
                        {
                            $or: [
                                { connectorClass: { $exists: true, $type: 'string', $ne: '' } },
                                { implClass: { $exists: true, $type: 'string', $ne: '' } },
                            ],
                        },
                    ],
                })
                .select('slug providerSlug name connectorClass implClass')
                .sort({ name: 1 })
                .lean()
                .exec(),
        ]);

        const pickerMap = new Map<string, { value: string; label: string }>();

        for (const r of oauthRows) {
            const slug = (r.providerSlug || r.slug) as string;
            const hasImpl = !!(r.connectorClass || r.implClass);
            if (!slug || !hasImpl) continue;
            const label = (r.name as string) || slug;
            pickerMap.set(slug, { value: slug, label });
        }
        for (const r of builderRows) {
            if (!r.providerKey) continue;
            pickerMap.set(r.providerKey, {
                value: r.providerKey,
                label: r.name || r.providerKey,
            });
        }

        return Array.from(pickerMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    async createCatalogBuilder(dto: CreateProviderDto) {
        const collision = await this.model.findOne({
            $or: [
                { providerKey: dto.providerKey },
                { slug: dto.providerKey },
                { providerSlug: dto.providerKey.toLowerCase() },
            ],
        });
        if (collision) {
            throw new ConflictException(
                `A provider with key or slug "${dto.providerKey}" already exists`,
            );
        }
        const impl = (dto.implClass || '').trim();
        if (impl) {
            const providerCollision = await this.model.findOne({ provider: impl }).lean().exec();
            if (providerCollision) {
                throw new ConflictException(
                    `A DataSource with provider "${impl}" already exists; edit that row instead of creating a catalog duplicate.`,
                );
            }
        }

        const category = dto.category as ProviderCategory | undefined;
        try {
            return await this.model.create({
                name: dto.displayName,
                slug: `catalog-${dto.providerKey}`,
                provider: impl || dto.providerKey,
                providerSlug: dto.providerKey.toLowerCase().replace(/_/g, '-'),
                providerKey: dto.providerKey,
                description: dto.description,
                category,
                implClass: dto.implClass,
                connectorClass: dto.implClass,
                authType: dto.authType ?? AuthType.API_KEY,
                authScope: dto.authScope ?? AuthScope.ORGANIZATION,
                icon: dto.icon,
                imageUrl: dto.imageUrl,
                isActive: dto.isEnabled !== false,
                catalogSource: CatalogSource.BUILDER,
                kind: DataSourceKind.EXTERNAL,
                requiredByDefault: false,
            });
        } catch (error) {
            throw new Error(`Failed to create catalog builder: ${error?.message || error}`);
        }
   
    }

    async updateCatalogRow(id: string, dto: UpdateProviderDto) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Provider not found');
        }
        const raw = await this.model.findById(id).lean().exec();
        if (!raw) {
            throw new NotFoundException('Provider not found');
        }

        if (DataSourcesService.isProtectedOauthSeed(raw as Record<string, unknown>)) {
            throw new BadRequestException(
                'This row is from the OAuth provider seed (slug). Edit `provider-catalog.json` and re-seed, or add a separate builder-catalog row with the same providerKey.',
            );
        }

        const current = raw as DataSource & { _id: Types.ObjectId };
        if (
            dto.providerKey &&
            dto.providerKey !== current.providerKey
        ) {
            const collision = await this.model
                .findOne({
                    providerKey: dto.providerKey,
                    _id: { $ne: new Types.ObjectId(id) },
                })
                .lean()
                .exec();
            if (collision) {
                throw new ConflictException(
                    `A Provider with providerKey "${dto.providerKey}" already exists`,
                );
            }
        }

        const set: Record<string, unknown> = {};
        if (dto.displayName !== undefined) set.name = dto.displayName;
        if (dto.description !== undefined) set.description = dto.description;
        if (dto.category !== undefined) set.category = dto.category as ProviderCategory;
        if (dto.implClass !== undefined) {
            set.implClass = dto.implClass;
            set.connectorClass = dto.implClass;
        }
        if (dto.providerKey !== undefined) {
            set.providerKey = dto.providerKey;
            set.providerSlug = dto.providerKey.toLowerCase().replace(/_/g, '-');
        }
        if (dto.icon !== undefined) set.icon = dto.icon;
        if (dto.imageUrl !== undefined) set.imageUrl = dto.imageUrl;
        if (dto.isEnabled !== undefined) set.isActive = dto.isEnabled;
        if (dto.authType !== undefined) set.authType = dto.authType;
        if (dto.authScope !== undefined) set.authScope = dto.authScope;

        const updated = await this.model
            .findByIdAndUpdate(id, { $set: set }, { new: true })
            .exec();
        if (!updated) {
            throw new NotFoundException('Provider not found');
        }
        return updated;
    }

    async removeCatalogRow(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Provider not found');
        }
        const raw = await this.model.findById(id).lean().exec();
        if (!raw) {
            throw new NotFoundException('Provider not found');
        }

        await this.ensureNoConnectionsReference(id);

        if (DataSourcesService.isProtectedOauthSeed(raw as Record<string, unknown>)) {
            throw new BadRequestException(
                'Cannot delete OAuth seed catalog rows from this UI. Remove from `provider-catalog.json` and re-seed if needed.',
            );
        }

        const deleted = await this.model.findByIdAndDelete(id).exec();
        if (!deleted) {
            throw new NotFoundException('Provider not found');
        }
        return { deleted: true };
    }

    async create(dto: CreateDataSourceDto) {
        const normalized = this.normalize(dto as Partial<DataSource>);
        this.validateInvariants(normalized);
        const existing = await this.model.findOne({ provider: normalized.provider }).lean().exec();
        if (existing) {
            throw new ConflictException(
                `A DataSource with provider "${normalized.provider}" already exists`,
            );
        }
        return this.model.create(normalized);
    }

    async update(id: string, dto: UpdateDataSourceDto) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException('DataSource not found');
        }
        const current = await this.model.findById(id).lean().exec();
        if (!current) throw new NotFoundException('DataSource not found');

        const merged = this.normalize({
            name: dto.name ?? current.name,
            slug: dto.slug ?? current.slug,
            provider: dto.provider ?? current.provider,
            providerSlug: dto.providerSlug ?? current.providerSlug,
            type: dto.type ?? current.type,
            kind: dto.kind ?? current.kind,
            authType: dto.authType ?? current.authType,
            baseEndpoint: dto.baseEndpoint ?? current.baseEndpoint,
            requiredByDefault: dto.requiredByDefault ?? current.requiredByDefault,
            isActive: dto.isActive ?? current.isActive,
            providerKey: dto.providerKey ?? current.providerKey,
            implClass: dto.implClass ?? current.implClass,
            connectorClass: dto.connectorClass ?? current.connectorClass,
            category: (dto.category as ProviderCategory) ?? current.category,
            authScope: dto.authScope ?? current.authScope,
            icon: dto.icon ?? current.icon,
            imageUrl: dto.imageUrl ?? current.imageUrl,
            catalogSource: dto.catalogSource ?? current.catalogSource,
            description: dto.description ?? current.description,
        });
        this.validateInvariants(merged);

        if (merged.provider !== current.provider) {
            const collision = await this.model
                .findOne({ provider: merged.provider, _id: { $ne: new Types.ObjectId(id) } })
                .lean()
                .exec();
            if (collision) {
                throw new ConflictException(
                    `A DataSource with provider "${merged.provider}" already exists`,
                );
            }
        }

        const updated = await this.model
            .findByIdAndUpdate(id, { $set: merged }, { new: true })
            .exec();
        if (!updated) throw new NotFoundException('DataSource not found');
        return updated;
    }

    async remove(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException('DataSource not found');
        }
        const usage = await this.integrationModel
            .countDocuments({ dataSourceId: new Types.ObjectId(id) })
            .exec();
        if (usage > 0) {
            throw new ConflictException(
                `Cannot delete: ${usage} service integration(s) still reference this data source`,
            );
        }
        await this.ensureNoConnectionsReference(id);
        const deleted = await this.model.findByIdAndDelete(id).exec();
        if (!deleted) throw new NotFoundException('DataSource not found');
        return { deleted: true };
    }

    /** Resolve datasource id for connections / OAuth (by public slug key). */
    async resolveIdByProviderSlug(providerSlug: string): Promise<Types.ObjectId | null> {
        const row = await this.model
            .findOne({
                isActive: true,
                providerSlug,
            })
            .select('_id')
            .lean()
            .exec();
        if (row?._id) return row._id as Types.ObjectId;
        const byKey = await this.model
            .findOne({
                isActive: true,
                providerKey: providerSlug,
            })
            .select('_id')
            .lean()
            .exec();
        return (byKey?._id as Types.ObjectId) ?? null;
    }

    private normalize(input: Partial<DataSource>): DataSource {
        const kind = (input.kind as DataSourceKind) ?? DataSourceKind.EXTERNAL;
        const authType =
            kind === DataSourceKind.INTERNAL
                ? AuthType.NONE
                : ((input.authType as AuthType) ?? AuthType.API_KEY);
        const name = (input.name ?? '').trim();
        const provider = (input.provider ?? '').trim();
        return {
            name,
            slug: (input.slug ?? '').trim() || name.toLowerCase().replace(/\s+/g, '-'),
            provider,
            providerSlug:
                (input.providerSlug ?? '').trim() || provider.toLowerCase(),
            type: input.type as DataSource['type'],
            kind,
            authType,
            baseEndpoint: input.baseEndpoint ?? '',
            requiredByDefault: input.requiredByDefault ?? false,
            isActive: input.isActive ?? true,
            catalogSource: input.catalogSource,
            providerKey: input.providerKey,
            implClass: input.implClass,
            connectorClass: input.connectorClass,
            category: input.category,
            authScope: input.authScope,
            icon: input.icon,
            imageUrl: input.imageUrl,
            description: input.description,
            connectionContract: input.connectionContract,
            oauthConfig: input.oauthConfig,
        } as DataSource;
    }

    private validateInvariants(row: DataSource): void {
        if (!row.name) throw new BadRequestException('name is required');
        if (!row.provider) throw new BadRequestException('provider is required');

        if (row.kind === DataSourceKind.INTERNAL) {
            if (row.authType !== AuthType.NONE) {
                throw new BadRequestException('Internal data sources must use authType="none"');
            }
            const registered = this.registry.getRegisteredProviderNames();
            if (!registered.includes(row.provider)) {
                throw new BadRequestException(
                    `Internal data sources must match a registered provider. Allowed: ${registered.join(', ')}`,
                );
            }
        }
    }

    private normalizeUnifiedRow(raw: Record<string, unknown>): UnifiedCatalogRow | null {
        const p = raw as Record<string, any>;
        const id = p._id as Types.ObjectId | undefined;
        if (!id) return null;

        if (p.providerKey && typeof p.providerKey === 'string' && p.providerKey !== '') {
            const cs = p.catalogSource as string | undefined;
            return {
                _id: id,
                providerKey: p.providerKey,
                displayName: String(p.name ?? p.providerKey),
                description: p.description != null ? String(p.description) : undefined,
                category: p.category != null ? String(p.category) : undefined,
                implClass: p.implClass != null ? String(p.implClass) : undefined,
                authType: p.authType != null ? String(p.authType) : undefined,
                authScope: p.authScope != null ? String(p.authScope) : undefined,
                icon: p.icon != null ? String(p.icon) : undefined,
                imageUrl: p.imageUrl != null ? String(p.imageUrl) : undefined,
                isEnabled: p.isActive !== false,
                catalogSource:
                    cs === CatalogSource.UNIFIED
                        ? 'unified'
                        : cs === CatalogSource.OAUTH
                          ? 'oauth'
                          : 'builder',
            };
        }

        const slug =
            p.slug && typeof p.slug === 'string' && p.slug !== ''
                ? String(p.slug)
                : p.providerSlug && typeof p.providerSlug === 'string'
                  ? String(p.providerSlug)
                  : '';
        if (!slug) return null;

        const impl = p.connectorClass ?? p.implClass;
        const cs = p.catalogSource as string | undefined;
        return {
            _id: id,
            providerKey: slug,
            displayName: String(p.name ?? slug),
            description: p.description != null ? String(p.description) : undefined,
            category: p.category != null ? String(p.category) : undefined,
            implClass: impl != null ? String(impl) : undefined,
            authType: p.authType != null ? String(p.authType) : undefined,
            authScope: p.authScope != null ? String(p.authScope) : undefined,
            icon: p.icon != null ? String(p.icon) : undefined,
            imageUrl: p.imageUrl != null ? String(p.imageUrl) : undefined,
            isEnabled: p.isActive !== false,
            catalogSource:
                cs === CatalogSource.UNIFIED
                    ? 'unified'
                    : cs === CatalogSource.BUILDER
                      ? 'builder'
                      : 'oauth',
        };
    }

    private async ensureNoConnectionsReference(id: string): Promise<void> {
        const n = await this.connectionModel
            .countDocuments({ dataSourceId: new Types.ObjectId(id) })
            .exec();
        if (n > 0) {
            throw new ConflictException(
                `Cannot delete: ${n} connection(s) still reference this data source`,
            );
        }
    }

    private static isProtectedOauthSeed(raw: Record<string, unknown>): boolean {
        const p = raw as Record<string, any>;
        if (p.catalogSource === CatalogSource.OAUTH) return true;
        return (
            !!p.slug &&
            typeof p.slug === 'string' &&
            (!p.providerKey || p.providerKey === '' || p.providerKey == null)
        );
    }
}
