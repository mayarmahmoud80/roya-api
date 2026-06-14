import { FlowValidationTargetType, ValidationIssueSeverity } from '../common/enums/builder-node.enum';

export interface LocalizedMessage {
    defaultLanguage: string;
    values: Record<string, string>;
}

export interface DynamicValidationIssue {
    code: string;
    path: string;
    nodeId?: string;
    connectionId?: string;
    message: LocalizedMessage;
    severity: ValidationIssueSeverity;
}

export interface FlowValidationResultPayload {
    targetType: FlowValidationTargetType;
    targetId?: string;
    blockingErrors: DynamicValidationIssue[];
    warnings: DynamicValidationIssue[];
    graphStats: { nodeCount: number; connectionCount: number; terminalPathCount: number };
    checkedAt: Date;
}

const en = (msg: string): LocalizedMessage => ({ defaultLanguage: 'en', values: { en: msg } });

export function flowIssue(
    code: string,
    path: string,
    message: string,
    severity: ValidationIssueSeverity = ValidationIssueSeverity.ERROR,
    refs?: { nodeId?: string; connectionId?: string },
): DynamicValidationIssue {
    return {
        code,
        path,
        message: en(message),
        severity,
        ...refs,
    };
}
