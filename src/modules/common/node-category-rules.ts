import { NodeCategory, NodeKind } from './enums/builder-node.enum';

/**
 * Default connection matrix between categories. A directed pair `(source, target)` is listed
 * iff a node of `source` is allowed to feed a node of `target`. Port-level value type and
 * min/max-connection rules still apply on top of this gate.
 *
 * Rules:
 *  INPUT    -> SOURCE | TRANSFORM | AI
 *  SOURCE   -> SOURCE | TRANSFORM | SCHEMA | AI | TERMINAL
 *  TRANSFORM-> SCHEMA | AI | TERMINAL | TRANSFORM
 *  SCHEMA   -> AI | TERMINAL
 *  AI       -> TERMINAL
 *  TERMINAL -> (nothing, terminals end a branch)
 *
 * Source→source is allowed so one source can feed another (e.g. a WebScraper's HTML payload
 * can be consumed by the LogoPicker source instead of re-scraping).
 */
export const NODE_CATEGORY_RULES: Record<NodeCategory, NodeCategory[]> = {
    [NodeCategory.INPUT]: [NodeCategory.SOURCE, NodeCategory.TRANSFORM, NodeCategory.AI],
    [NodeCategory.SOURCE]: [
        NodeCategory.SOURCE,
        NodeCategory.TRANSFORM,
        NodeCategory.SCHEMA,
        NodeCategory.AI,
        NodeCategory.TERMINAL,
    ],
    [NodeCategory.TRANSFORM]: [
        NodeCategory.TRANSFORM,
        NodeCategory.SCHEMA,
        NodeCategory.AI,
        NodeCategory.TERMINAL,
    ],
    [NodeCategory.SCHEMA]: [NodeCategory.AI, NodeCategory.TERMINAL],
    [NodeCategory.AI]: [NodeCategory.TERMINAL],
    [NodeCategory.TERMINAL]: [],
};

/** Fallback map used to derive a category for legacy node definitions that only have a kind. */
export const NODE_KIND_TO_CATEGORY: Record<NodeKind, NodeCategory> = {
    [NodeKind.INPUT_FIELD]: NodeCategory.INPUT,
    [NodeKind.DATA_SOURCE]: NodeCategory.SOURCE,
    [NodeKind.TRANSFORM]: NodeCategory.TRANSFORM,
    [NodeKind.OUTPUT_SCHEMA]: NodeCategory.SCHEMA,
    [NodeKind.AI_PROVIDER]: NodeCategory.AI,
    [NodeKind.TERMINAL]: NodeCategory.TERMINAL,
};

export function resolveCategory(
    category: NodeCategory | undefined | null,
    nodeKind: NodeKind | string | undefined | null,
): NodeCategory | undefined {
    if (category) {
        return category;
    }
    if (nodeKind === 'mapper' || nodeKind === 'merger') {
        return NodeCategory.TRANSFORM;
    }
    if (nodeKind != null && nodeKind !== '') {
        return NODE_KIND_TO_CATEGORY[nodeKind as NodeKind];
    }
    return undefined;
}

export function isCategoryPairAllowed(source: NodeCategory, target: NodeCategory): boolean {
    return NODE_CATEGORY_RULES[source]?.includes(target) ?? false;
}
