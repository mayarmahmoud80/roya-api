import { NodeConnectionPointDto } from '../builder-assets/dto/node-definition.dto';
import { DataSourceConnectionPort } from './connection-contract.types';

export function mapConnectionPortsToNodeDtos(ports: Record<string, DataSourceConnectionPort>): NodeConnectionPointDto[] {
    return Object.values(ports).map(mapConnectionPortToNodeDto);
}

function mapConnectionPortToNodeDto(p: DataSourceConnectionPort): NodeConnectionPointDto {
    return {
        key: p.key,
        direction: p.direction,
        label: { defaultLanguage: 'en', values: { en: p.key } },
        valueType: p.valueType,
        required: p.required,
        minConnections: p.minConnections,
        maxConnections: p.maxConnections,
        compatibleNodeKinds: p.compatibleNodeKinds,
        compatibleNodeTypeKeys: p.compatibleNodeTypeKeys,
        compatibleValueTypes: p.compatibleValueTypes,
        validationRules: undefined,
        errorMessage: undefined,
    };
}
