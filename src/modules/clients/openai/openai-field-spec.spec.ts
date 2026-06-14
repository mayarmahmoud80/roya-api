import { buildFieldSpec } from './openai.service';
import { COLUMN_CHART_OUTPUT_EXAMPLE } from '../../analyses/output-field-value-templates';

describe('buildFieldSpec', () => {
    it('appends Example JSON for column_chart from OUTPUT_FIELD_VALUE_TEMPLATES', () => {
        const spec = buildFieldSpec({ brandMetrics: 'column_chart' });
        expect(spec).toContain('brandMetrics (column_chart)');
        expect(spec).toContain('Example JSON value:');
        expect(spec).toContain(JSON.stringify(COLUMN_CHART_OUTPUT_EXAMPLE));
    });

    it('omits example line when type has no template', () => {
        const spec = buildFieldSpec({ title: 'text' });
        expect(spec).toBe('- title (text): 1-3 sentence paragraph of free-form text.');
        expect(spec).not.toContain('Example JSON value');
    });
});
