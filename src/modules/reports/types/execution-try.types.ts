export type NodeTryStatus = 'completed' | 'failed' | 'skipped';
export type TryStatus = 'completed' | 'failed';
export type TryTrigger = 'initial' | 'regenerate';

export interface NodeTry {
    nodeId: string;
    nodeKey?: string;
    nodeCategory?: string;
    label?: string;
    status: NodeTryStatus;
    startedAt: Date;
    finishedAt?: Date;
    durationMs?: number;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
}

export interface ReportExecutionTry {
    tryNumber: number;
    trigger: TryTrigger;
    status: TryStatus;
    flowSnapshotVersion?: number;
    startedAt: Date;
    finishedAt: Date;
    durationMs: number;
    errorMessage?: string;
    nodes: NodeTry[];
}
