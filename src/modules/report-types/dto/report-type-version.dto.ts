/**
 * Re-export of the dynamic-flow DTOs used to save and validate the DAG on a report type
 * version. The legacy pre-DAG draft DTOs (`InputSchemaFieldDto`, `ReportTypeDataSourceDto`,
 * `OutputSchemaSectionDto`, `OutputAiMappingDto`, `ReportTypeFlowLayoutDto`,
 * `ReportTypeVersionDraftDto`) were removed with the DAG-only refactor.
 */
export {
    FlowValidationResultDto,
    ReportFlowConnectionDto,
    ReportFlowDraftInputDto,
    ReportFlowDraftResponseDto,
    ReportFlowNodeDto,
    ValidationIssueDto,
} from './dynamic-flow.dto';
