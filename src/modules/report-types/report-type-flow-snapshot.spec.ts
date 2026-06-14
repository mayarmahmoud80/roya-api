import { Types } from 'mongoose';
import { buildPublishedFlowSnapshot, computeTerminalPaths } from './report-type-flow-snapshot';
import { NodeKind } from '../common/enums/builder-node.enum';
import { FlowValidationTargetType } from '../common/enums/builder-node.enum';

describe('report-type-flow-snapshot', () => {
    it('computeTerminalPaths finds a path to each terminal', () => {
        const nodes = [
            { nodeId: 'a', nodeKind: NodeKind.INPUT_FIELD, required: true },
            { nodeId: 'b', nodeKind: NodeKind.TERMINAL, required: true, terminalConfig: { terminalKey: 't1', required: true, outputMode: 'x' } },
        ] as Parameters<typeof computeTerminalPaths>[0];
        const connections = [
            { connectionId: 'c1', source: { nodeId: 'a', portKey: 'o' }, target: { nodeId: 'b', portKey: 'i' }, required: true },
        ] as Parameters<typeof computeTerminalPaths>[1];
        const paths = computeTerminalPaths(nodes, connections);
        expect(paths.length).toBeGreaterThan(0);
        expect(paths[0].terminalNodeId).toBe('b');
    });

    it('buildPublishedFlowSnapshot embeds a copy of node definition docs for publication', () => {
        const defId = new Types.ObjectId();
        const snap = buildPublishedFlowSnapshot({
            defaultLanguage: 'en',
            flowNodes: [
                { nodeId: 'n1', definitionAssetId: defId, nodeKind: NodeKind.INPUT_FIELD, required: true },
            ],
            flowConnections: [],
            nodeDefinitionDocs: [
                { _id: defId, slug: 'nd-input', nodeDefinition: { nodeKind: NodeKind.INPUT_FIELD } } as never,
            ],
            validationSummary: {
                targetType: FlowValidationTargetType.REPORT_FLOW,
                checkedAt: new Date(),
                blockingErrors: [],
                warnings: [],
                graphStats: { nodeCount: 1, connectionCount: 0, terminalPathCount: 0 },
            },
        });
        expect(snap['snapshotVersion']).toBe(1);
        expect(snap['nodeDefinitions']).toBeDefined();
        expect((snap['nodeDefinitions'] as unknown[]).length).toBe(1);
    });
});
