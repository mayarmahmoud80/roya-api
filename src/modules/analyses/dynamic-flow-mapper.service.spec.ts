import { MapperTransform } from '../common/enums/builder-node.enum';
import { DynamicFlowMapperService } from './dynamic-flow-mapper.service';

/** Covers dynamic pipeline mapping (US2) without loading the full analysis processor ESM graph. */
describe('DynamicFlowMapperService', () => {
    const mapper = new DynamicFlowMapperService();

    it('applies direct mapping from source to target path', () => {
        const out = mapper.applyRules(
            { a: { b: 1 } },
            [
                {
                    targetPath: 'c',
                    sourcePath: 'a.b',
                    transform: MapperTransform.DIRECT,
                    required: true,
                },
            ],
        );
        expect(out['c']).toBe(1);
    });

    it('applies default value when target is missing', () => {
        const out = mapper.applyRules(
            {},
            [
                {
                    targetPath: 'x',
                    transform: MapperTransform.DEFAULT_VALUE,
                    required: false,
                    parameters: { value: 'fallback' },
                },
            ],
        );
        expect(out['x']).toBe('fallback');
    });
});
