/**
 * Example JSON values per output field type, appended to OpenAI `buildFieldSpec` lines so models
 * see the exact shape expected at runtime. Add a key when introducing a new structured type.
 */
export const COLUMN_CHART_OUTPUT_EXAMPLE = {
    labels: ['Brand A', 'Brand B', 'Brand C'],
    datasets: [
        {
            label: 'Market Share',
            data: [72, 58, 44],
            backgroundColor: '#2563eb',
            borderRadius: 10,
            barThickness: 32,
        },
        {
            label: 'Social Presence',
            data: [65, 82, 51],
            backgroundColor: '#f97316',
            borderRadius: 10,
            barThickness: 32,
        },
        {
            label: 'Customer Rating',
            data: [88, 76, 69],
            backgroundColor: '#10b981',
            borderRadius: 10,
            barThickness: 32,
        },
    ],
} as const;

/** Keys match `OUTPUT_FIELD_TYPES` / flow builder type strings. */
export const OUTPUT_FIELD_VALUE_TEMPLATES: Record<string, unknown> = {
    column_chart: COLUMN_CHART_OUTPUT_EXAMPLE,
};
