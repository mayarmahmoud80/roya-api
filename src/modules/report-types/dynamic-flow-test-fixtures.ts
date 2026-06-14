import { NodeKind } from '../common/enums/builder-node.enum';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { BuilderAssetType } from '../common/enums/builder-asset-type.enum';
import { AssetScope } from '../common/enums/asset-scope.enum';
import { NodeConnectionDirection } from '../common/enums/builder-node.enum';
import { BuilderValueType } from '../common/enums/builder-node.enum';
import { BuilderNodeExecutionRole } from '../common/enums/builder-node.enum';

const lt = (en: string) => ({ defaultLanguage: 'en' as const, values: { en } });

const point = (
    key: string,
    direction: NodeConnectionDirection,
    valueType: BuilderValueType,
    required: boolean,
    minConnections: number,
    compatible: BuilderValueType[],
) => ({
    key,
    direction,
    label: lt(key),
    valueType,
    required,
    minConnections,
    compatibleValueTypes: compatible,
});

/** Minimal in-memory node definition for contract/unit tests. */
export function makeTestNodeDefinitionInput(kind: NodeKind) {
    const base = {
        nodeKind: kind,
        name: lt('Test node'),
        slug: `test-${kind}-${Date.now()}`,
        scope: AssetScope.GLOBAL,
        status: BuilderAssetStatus.ACTIVE,
        allowedSourceKinds: [] as NodeKind[],
        allowedTargetKinds: [] as NodeKind[],
        configSchema: {},
        executionRole: BuilderNodeExecutionRole.SOURCE,
        defaultRequired: true,
    };
    if (kind === NodeKind.TERMINAL) {
        return {
            ...base,
            assetType: BuilderAssetType.NODE_DEFINITION,
            inputs: [point('in', NodeConnectionDirection.INPUT, BuilderValueType.ANY, true, 1, [BuilderValueType.ANY])],
            outputs: [],
        };
    }
    if (kind === NodeKind.INPUT_FIELD) {
        return {
            ...base,
            assetType: BuilderAssetType.NODE_DEFINITION,
            inputs: [],
            outputs: [point('value', NodeConnectionDirection.OUTPUT, BuilderValueType.STRING, true, 0, [BuilderValueType.STRING, BuilderValueType.ANY])],
        };
    }
    return {
        ...base,
        assetType: BuilderAssetType.NODE_DEFINITION,
        inputs: [point('in', NodeConnectionDirection.INPUT, BuilderValueType.OBJECT, true, 1, [BuilderValueType.OBJECT])],
        outputs: [point('out', NodeConnectionDirection.OUTPUT, BuilderValueType.OBJECT, true, 0, [BuilderValueType.OBJECT])],
    };
}
