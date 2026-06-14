import { Types } from 'mongoose';
import { ReportTypeBuilderValidationService } from './report-type-builder-validation.service';
import { NodeKind, BuilderValueType, NodeConnectionDirection, BuilderNodeExecutionRole, NodeCategory } from '../common/enums/builder-node.enum';
import { BuilderAssetType } from '../common/enums/builder-asset-type.enum';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';

const point = (key: string, vt: BuilderValueType, dir: NodeConnectionDirection) => ({
    key,
    direction: dir,
    label: { defaultLanguage: 'en', values: { en: key } },
    valueType: vt,
    required: true,
    minConnections: 0,
    compatibleValueTypes: [vt, BuilderValueType.ANY],
});

describe('ReportTypeBuilderValidationService', () => {
    const builderCategoryModel = {
        find: jest.fn(() => ({
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => []),
        })),
    };
    const service = new ReportTypeBuilderValidationService(builderCategoryModel as never);

    it('returns blocking error for empty flow', async () => {
        const r = await service.validateDynamicReportFlow([], [], []);
        expect(r.blockingErrors.length).toBeGreaterThan(0);
    });

    it('flags incompatible connection', async () => {
        const id1 = new Types.ObjectId();
        const id2 = new Types.ObjectId();
        const defs = [
            {
                _id: id1,
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.INPUT_FIELD,
                    inputs: [],
                    outputs: [point('value', BuilderValueType.STRING, NodeConnectionDirection.OUTPUT)],
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            },
            {
                _id: id2,
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.INPUT_FIELD,
                    inputs: [point('in', BuilderValueType.NUMBER, NodeConnectionDirection.INPUT)],
                    outputs: [],
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            },
        ];
        const flowNodes = [
            { nodeId: 'a', definitionAssetId: id1, nodeKind: NodeKind.INPUT_FIELD, required: true },
            { nodeId: 'b', definitionAssetId: id2, nodeKind: NodeKind.INPUT_FIELD, required: true },
        ];
        const flowConnections = [
            {
                connectionId: 'c1',
                source: { nodeId: 'a', portKey: 'value' },
                target: { nodeId: 'b', portKey: 'in' },
                required: true,
            },
        ];
        const r = await service.validateDynamicReportFlow(flowNodes, flowConnections, defs as never);
        expect(r.blockingErrors.length + r.warnings.length).toBeGreaterThan(0);
    });

    it('flags graphs with no terminal node', async () => {
        const id = new Types.ObjectId();
        const defs = [
            {
                _id: id,
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.INPUT_FIELD,
                    inputs: [],
                    outputs: [point('value', BuilderValueType.STRING, NodeConnectionDirection.OUTPUT)],
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            },
        ];
        const r = await service.validateDynamicReportFlow(
            [{ nodeId: 'only', definitionAssetId: id, nodeKind: NodeKind.INPUT_FIELD, required: true }],
            [],
            defs as never,
        );
        expect(r.blockingErrors.some(e => e.code === 'no_terminal')).toBe(true);
    });

    it('flags builderCategoryKey mismatch against the selected definition', async () => {
        const id = new Types.ObjectId();
        const defs = [
            {
                _id: id,
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.INPUT_FIELD,
                    category: NodeCategory.INPUT,
                    builderCategoryKey: 'intake',
                    nodeTypeKey: 'url-input',
                    inputs: [],
                    outputs: [point('value', BuilderValueType.STRING, NodeConnectionDirection.OUTPUT)],
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            },
        ];

        const r = await service.validateDynamicReportFlow(
            [
                {
                    nodeId: 'only',
                    definitionAssetId: id,
                    nodeKind: NodeKind.INPUT_FIELD,
                    category: NodeCategory.INPUT,
                    builderCategoryKey: 'reasoning',
                    nodeTypeKey: 'url-input',
                    required: true,
                },
            ],
            [],
            defs as never,
        );

        expect(r.blockingErrors.some(e => e.code === 'builder_category_key_mismatch')).toBe(true);
    });

    it('allows legacy flow builderCategoryKey equal to semantic NodeCategory when catalog uses taxonomy key', async () => {
        const id = new Types.ObjectId();
        const defs = [
            {
                _id: id,
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.DATA_SOURCE,
                    category: NodeCategory.SOURCE,
                    builderCategoryKey: 'acquisition',
                    inputs: [point('in', BuilderValueType.STRING, NodeConnectionDirection.INPUT)],
                    outputs: [point('payload', BuilderValueType.STRING, NodeConnectionDirection.OUTPUT)],
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            },
        ];

        const r = await service.validateDynamicReportFlow(
            [
                {
                    nodeId: 'legacy-src',
                    definitionAssetId: id,
                    nodeKind: NodeKind.DATA_SOURCE,
                    category: NodeCategory.SOURCE,
                    builderCategoryKey: NodeCategory.SOURCE,
                    required: true,
                },
            ],
            [],
            defs as never,
        );

        expect(r.blockingErrors.some(e => e.code === 'builder_category_key_mismatch')).toBe(false);
    });

    it('allows intake → data source when target builderCategoryKey matches category policy (acquisition)', async () => {
        const intakeId = new Types.ObjectId();
        const sourceId = new Types.ObjectId();
        const defs = [
            {
                _id: intakeId,
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.INPUT_FIELD,
                    category: NodeCategory.INPUT,
                    builderCategoryKey: 'intake',
                    inputs: [],
                    outputs: [point('value', BuilderValueType.STRING, NodeConnectionDirection.OUTPUT)],
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            },
            {
                _id: sourceId,
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.DATA_SOURCE,
                    category: NodeCategory.SOURCE,
                    builderCategoryKey: 'acquisition',
                    inputs: [point('in', BuilderValueType.STRING, NodeConnectionDirection.INPUT)],
                    outputs: [point('payload', BuilderValueType.STRING, NodeConnectionDirection.OUTPUT)],
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            },
        ];
        const builderCategoryModelWithPolicy = {
            find: jest.fn(() => ({
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn(async () => [
                    {
                        key: 'intake',
                        slug: 'intake',
                        allowedOutgoingCategoryKeys: ['acquisition', 'enrichment', 'transform', 'reasoning'],
                    },
                ]),
            })),
        };
        const svc = new ReportTypeBuilderValidationService(builderCategoryModelWithPolicy as never);
        const flowNodes = [
            { nodeId: 'in1', definitionAssetId: intakeId, nodeKind: NodeKind.INPUT_FIELD, required: true },
            { nodeId: 'src1', definitionAssetId: sourceId, nodeKind: NodeKind.DATA_SOURCE, required: true },
        ];
        const flowConnections = [
            {
                connectionId: 'e1',
                source: { nodeId: 'in1', portKey: 'value' },
                target: { nodeId: 'src1', portKey: 'in' },
                required: true,
            },
        ];
        const r = await svc.validateDynamicReportFlow(flowNodes, flowConnections, defs as never);
        expect(r.blockingErrors.some(e => e.code === 'incompatible_node_categories')).toBe(false);
    });
});
