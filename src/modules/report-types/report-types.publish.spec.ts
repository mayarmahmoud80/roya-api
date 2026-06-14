import { Types } from 'mongoose';
import { buildPublishedFlowSnapshot } from './report-type-flow-snapshot';
import { NodeKind } from '../common/enums/builder-node.enum';
import { FlowValidationTargetType } from '../common/enums/builder-node.enum';

describe('Report type publish (dynamic snapshot)', () => {
    it('embeds full node definition payloads so later catalog edits do not change this snapshot object by reference update alone', () => {
        const defId = new Types.ObjectId();
        const doc = {
            _id: defId,
            slug: 'nd-original',
            nodeDefinition: { nodeKind: NodeKind.TERMINAL },
        } as Record<string, unknown>;
        const snap = buildPublishedFlowSnapshot({
            defaultLanguage: 'en',
            flowNodes: [
                { nodeId: 't1', definitionAssetId: defId, nodeKind: NodeKind.TERMINAL, required: true },
            ],
            flowConnections: [],
            nodeDefinitionDocs: [doc],
            validationSummary: {
                targetType: FlowValidationTargetType.REPORT_FLOW,
                checkedAt: new Date(),
                blockingErrors: [],
                warnings: [],
                graphStats: { nodeCount: 1, connectionCount: 0, terminalPathCount: 0 },
            },
        });
        const frozenSlug = (snap['nodeDefinitions'] as Array<{ slug: string }>)[0].slug;
        doc['slug'] = 'nd-changed';
        expect(frozenSlug).toBe('nd-original');
    });
});
