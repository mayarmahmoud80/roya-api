/** Browserless `/content` API — definition-driven output helpers (mirrors web-scraper.io pattern). */

export interface BrowserlessOutputPortMap {
    primaryPayloadKey: string;
    htmlKey: string;
}

export function mapBrowserlessOutputPorts(outputPortKeys: string[], providerLabel: string): BrowserlessOutputPortMap {
    if (outputPortKeys.length < 2) {
        throw new Error(
            `${providerLabel}: node definition must declare at least two OUTPUT ports (payload object + html string).`,
        );
    }
    return {
        primaryPayloadKey: outputPortKeys[0],
        htmlKey: outputPortKeys[1],
    };
}

export interface BrowserlessExecutionResult {
    html: string;
}

export function buildBrowserlessPayload(html: string): { html: string } {
    return { html };
}

export function writeBrowserlessResults(
    context: Record<string, unknown>,
    outputs: BrowserlessOutputPortMap,
    result: BrowserlessExecutionResult,
): void {
    context[outputs.primaryPayloadKey] = buildBrowserlessPayload(result.html);
    context[outputs.htmlKey] = result.html;
}
