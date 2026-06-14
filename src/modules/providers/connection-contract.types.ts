import { BuilderValueType, NodeConnectionDirection, NodeKind } from '../common/enums/builder-node.enum';

/** Declares one input or output port for a data-source provider (authoring + runtime alignment). */
export interface DataSourceConnectionPort {
    key: string;
    direction: NodeConnectionDirection;
    valueType: BuilderValueType;
    required: boolean;
    minConnections: number;
    compatibleValueTypes: BuilderValueType[];
    compatibleNodeKinds?: NodeKind[];
    compatibleNodeTypeKeys?: string[];
    maxConnections?: number;
}

/** Ports keyed by port `key` (must match each entry’s `key` field). */
export type DataSourceConnectionPortMap = Record<string, DataSourceConnectionPort>;

export interface DataSourceConnectionContract {
    inputs: DataSourceConnectionPortMap;
    outputs: DataSourceConnectionPortMap;
}
