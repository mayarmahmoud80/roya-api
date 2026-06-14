/** WebScraper-specific port mapping and context writes (definition-driven output keys). */

export interface WebScraperOutputPortMap {
    primaryPayloadKey: string;
    htmlKey: string;
}

/** Map ordered definition outputs to WebScraper context slots (third key defaults if omitted). */
export function mapWebScraperOutputPorts(outputPortKeys: string[], providerLabel: string): WebScraperOutputPortMap {
    if (outputPortKeys.length < 2) {
        throw new Error(
            `${providerLabel}: node definition must declare at least two OUTPUT ports (primary object + html).`,
        );
    }
    return {
        primaryPayloadKey: outputPortKeys[0],
        htmlKey: outputPortKeys[1],
    };
}

export interface WebScraperExecutionResult {
    scraped: unknown;
    html: string;
}

/** Write WebScraper results into the mutable context bucket using definition-driven keys. */
export function writeWebScraperResults(
    context: Record<string, unknown>,
    outputs: WebScraperOutputPortMap,
    result: WebScraperExecutionResult,
): void {
    context[outputs.primaryPayloadKey] = result.scraped;
    context[outputs.htmlKey] = result.html;
}
