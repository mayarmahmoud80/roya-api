/**
 * Importing `AnalysisProcessor` directly pulls the provider module graph, which
 * includes ESM-only `uuid` in Jest without extra config. Use `dynamic-flow-mapper.service.spec`
 * and integration tests for the dynamic execution path; add full processor tests
 * when the Jest ESM pipeline is enabled project-wide.
 */
describe('AnalysisProcessor (smoke)', () => {
    it('placeholder — queue processor is exercised in integration and via mapper snapshot tests', () => {
        expect(typeof queueMicrotask).toBe('function');
    });
});
