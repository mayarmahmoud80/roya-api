import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { OUTPUT_FIELD_VALUE_TEMPLATES } from '../../analyses/output-field-value-templates';

export interface OpenAIReportRequest {
    /** Stable identifier for this run, used only for log correlation. */
    slug: string;
    /** Human-readable label injected into the system + user prompts. */
    name: string;
    /** Optional JSON shape the model must return; when absent the model structures its response logically. */
    outputSchema?: Record<string, unknown>;
}

/**
 * Per-type format rules embedded in the system prompt. Keys match the closed vocabulary used by
 * the flow builder (`OutputFieldType`); unknown / legacy strings from older snapshots fall back
 * to "free-form text" via {@link buildFieldSpec}.
 */
const FIELD_TYPE_RULES: Record<string, string> = {
    text: '1-3 sentence paragraph of free-form text',
    string: '1-3 sentence paragraph of free-form text',
    score: 'decimal number from 0 to 10, e.g. 7.4',
    tag: 'single short lowercase label (no spaces, use hyphens if needed)',
    list: 'array of concise strings',
    array: 'array of concise strings',
    color: 'hex color string like "#ffffff"',
    color_scheme:
        'JSON array of hex strings in display order (palette), e.g. ["#2C1E73","#7B3DD9","#FF9D00"]',
    number: 'numeric value',
    url: 'absolute https URL',
    img: 'absolute https URL to a raster or SVG image',
    image: 'absolute https URL to a raster or SVG image',
    column_chart:
        'Chart.js bar chart data object: property `labels` (string array, X categories) and `datasets` (array of series, each with `label`, `data` number array same length as labels, optional `backgroundColor`, `borderRadius`, `barThickness`)',
};

/**
 * Flow snapshots sometimes attach the real `outputSchema` under the AI node's **input port key**
 * (e.g. `in`), so the object looks like `{ in: { summary: "text", logoUrl: "url" } }`. The
 * prompt must describe the **inner** field names, not the port id — otherwise the model is asked
 * for a single field `in` and may nest the payload under that key in the response.
 */
const SCHEMA_PORT_WRAPPER_KEYS = new Set(['in', 'out', 'input', 'output', 'schema', 'data']);

function isSimpleFieldTypeMap(obj: Record<string, unknown>): boolean {
    return Object.values(obj).every((v) => typeof v === 'string' && v.length > 0);
}

export function unwrapPortWrappedOutputSchema(
    schema: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
    if (!schema) return schema;
    const keys = Object.keys(schema);
    if (keys.length !== 1) return schema;
    const k = keys[0] as string;
    if (!SCHEMA_PORT_WRAPPER_KEYS.has(k.toLowerCase())) return schema;
    const inner = schema[k];
    if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) return schema;
    const rec = inner as Record<string, unknown>;
    if (!isSimpleFieldTypeMap(rec)) return schema;
    return rec;
}

/**
 * If the model still returns `{ in: { ... } }`, normalize to the inner object for downstream
 * consumers that expect a flat field map.
 */
function unwrapModelJsonIfPortWrapped(data: Record<string, unknown>): Record<string, unknown> {
    const keys = Object.keys(data);
    if (keys.length !== 1) return data;
    const k = keys[0] as string;
    if (!SCHEMA_PORT_WRAPPER_KEYS.has(k.toLowerCase())) return data;
    const inner = data[k];
    if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) return data;
    return inner as Record<string, unknown>;
}

/**
 * Render the schema as a bullet list of `- key (type): rule` lines so the model can see both the
 * field names AND per-field formatting constraints. Falls back to "free-form text" for any type
 * outside the closed vocabulary to stay backward-compatible with seed data using `'object'`, etc.
 */
export function buildFieldSpec(schema: Record<string, unknown>): string {
    const lines: string[] = [];
    for (const [key, rawType] of Object.entries(schema)) {
        const typeStr = typeof rawType === 'string' ? rawType.toLowerCase() : 'text';
        const rule = FIELD_TYPE_RULES[typeStr] ?? 'free-form text';
        let line = `- ${key} (${typeStr}): ${rule}.`;
        const template = OUTPUT_FIELD_VALUE_TEMPLATES[typeStr];
        if (template !== undefined) {
            line += ` Example JSON value: ${JSON.stringify(template)}`;
        }
        lines.push(line);
    }
    return lines.join('\n');
}

@Injectable()
export class OpenAIService {
    private readonly logger = new Logger(OpenAIService.name);

    /**
     * Generates a JSON report. With the DAG refactor the caller passes the output schema
     * directly (typically sourced from the upstream schema node's `config.outputSchema`),
     * not from a `ReportType` document.
     */
    async generateReport(
        request: OpenAIReportRequest,
        context: Record<string, unknown>,
        options?: {
            apiKey?: string;
            model?: string;
            inputs?: Record<string, unknown>;
            /** From analysis `inputs` at port named by AI node `config.promptSubjectInputKey`. */
            promptSubject?: string;
        },
    ): Promise<Record<string, unknown>> {
        const apiKey = options?.apiKey?.trim();
        if (!apiKey) {
            throw new Error('No OpenAI integration configured. Add an OpenAI integration with an API key for this organization.');
        }

        const model = options?.model || 'gpt-4o';
        const client = new OpenAI({ apiKey });

        const effectiveSchema = unwrapPortWrappedOutputSchema(request.outputSchema) ?? request.outputSchema;
        const hasSchema = effectiveSchema && Object.keys(effectiveSchema).length > 0;
        const systemPrompt = hasSchema
            ? `You are a professional marketing analyst.\nOutput ONLY valid JSON with EXACTLY these fields (no extras):\n${buildFieldSpec(effectiveSchema!)}`
            : `You are a professional marketing analyst.\nStructure your response logically for a ${request.name} report as valid JSON.`;

        const safeInputs = JSON.stringify(options?.inputs ?? {}).substring(0, 2000);
        const subject = (options?.promptSubject ?? '').trim();
        const analyzeLine = subject
            ? `Analyze "${subject}".`
            : 'Analyze the request using the user inputs and context below.';
        const userPrompt = `${analyzeLine}
Report type: ${request.name}
User inputs: ${safeInputs}
Context data: ${JSON.stringify(context).substring(0, 4000)}`;

        try {
            const response = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0]?.message?.content || '{}';
            const raw = JSON.parse(content) as Record<string, unknown>;
            return unwrapModelJsonIfPortWrapped(raw);
        } catch (err) {
            this.logger.error(`OpenAI error for ${request.slug}: ${(err as Error).message}`);
            throw err;
        }
    }

    async trackTokens(usage: { prompt_tokens: number; completion_tokens: number }): Promise<number> {
        return (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0);
    }
}
