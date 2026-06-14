/**
 * Single source of truth for data-source port shapes. Used by providers, builder persistence,
 * and seeds.
 */
import type { DataSourceConnectionContract, DataSourceConnectionPort } from '../connection-contract.types';
import { BuilderValueType, NodeConnectionDirection } from '../../common/enums/builder-node.enum';

const DS_COMPAT_OBJECT: BuilderValueType[] = [BuilderValueType.OBJECT, BuilderValueType.ANY];
const DS_COMPAT_STRING: BuilderValueType[] = [BuilderValueType.STRING, BuilderValueType.ANY];

const payloadOut = (): DataSourceConnectionPort => ({
    key: 'payload',
    direction: NodeConnectionDirection.OUTPUT,
    valueType: BuilderValueType.OBJECT,
    required: true,
    minConnections: 0,
    compatibleValueTypes: DS_COMPAT_OBJECT,
});

export const WEB_SCRAPER_CONNECTION_CONTRACT: DataSourceConnectionContract = {
    inputs: {
        websiteUrl: {
            key: 'websiteUrl',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: true,
            minConnections: 1,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
    },
    outputs: {
        payload: payloadOut(),
        html: {
            key: 'html',
            direction: NodeConnectionDirection.OUTPUT,
            valueType: BuilderValueType.STRING,
            required: false,
            minConnections: 0,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
    },
};

/** Browserless `/content` — same port shape as WebScraper; `payload` is `{ html: string }`. */
export const BROWSERLESS_CONNECTION_CONTRACT: DataSourceConnectionContract = {
    inputs: {
        websiteUrl: {
            key: 'websiteUrl',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: true,
            minConnections: 1,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
    },
    outputs: {
        payload: payloadOut(),
        html: {
            key: 'html',
            direction: NodeConnectionDirection.OUTPUT,
            valueType: BuilderValueType.STRING,
            required: false,
            minConnections: 0,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
    },
};

export const SEMRUSH_CONNECTION_CONTRACT: DataSourceConnectionContract = {
    inputs: {
        websiteUrl: {
            key: 'websiteUrl',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: true,
            minConnections: 1,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
    },
    outputs: {
        payload: payloadOut(),
    },
};

export const LOGO_PICKER_CONNECTION_CONTRACT: DataSourceConnectionContract = {
    inputs: {
        pageHtml: {
            key: 'pageHtml',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: true,
            minConnections: 1,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
        websiteUrl: {
            key: 'websiteUrl',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: false,
            minConnections: 0,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
        brandName: {
            key: 'brandName',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: false,
            minConnections: 0,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
    },
    outputs: {
        payload: payloadOut(),
    },
};

export const PRAVATAR_CONNECTION_CONTRACT: DataSourceConnectionContract = {
    inputs: {
        seed: {
            key: 'seed',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: true,
            minConnections: 1,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
    },
    outputs: {
        payload: payloadOut(),
    },
};

/** Matches `nd-source-openai-research` seed (stub provider). */
export const OPENAI_DATASOURCE_CONNECTION_CONTRACT: DataSourceConnectionContract = {
    inputs: {
        websiteUrl: {
            key: 'websiteUrl',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: true,
            minConnections: 1,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
        brandName: {
            key: 'brandName',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: false,
            minConnections: 0,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
    },
    outputs: {
        payload: payloadOut(),
    },
};

/** Stub provider — generic trigger + payload for catalog binding. */
export const GOOGLE_DATASOURCE_CONNECTION_CONTRACT: DataSourceConnectionContract = {
    inputs: {
        trigger: {
            key: 'trigger',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.ANY,
            required: false,
            minConnections: 0,
            compatibleValueTypes: [BuilderValueType.ANY],
        },
    },
    outputs: {
        payload: payloadOut(),
    },
};

/** Instagram provider — OAuth2-based profile insights and media data. */
export const INSTAGRAM_CONNECTION_CONTRACT: DataSourceConnectionContract = {
    inputs: {
        period: {
            key: 'period',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.STRING,
            required: false,
            minConnections: 0,
            compatibleValueTypes: DS_COMPAT_STRING,
        },
        includeMedia: {
            key: 'includeMedia',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.BOOLEAN,
            required: false,
            minConnections: 0,
            compatibleValueTypes: [BuilderValueType.BOOLEAN, BuilderValueType.ANY],
        },
        mediaLimit: {
            key: 'mediaLimit',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.NUMBER,
            required: false,
            minConnections: 0,
            compatibleValueTypes: [BuilderValueType.NUMBER, BuilderValueType.ANY],
        },
    },
    outputs: {
        payload: payloadOut(),
        profile: {
            key: 'profile',
            direction: NodeConnectionDirection.OUTPUT,
            valueType: BuilderValueType.OBJECT,
            required: false,
            minConnections: 0,
            compatibleValueTypes: DS_COMPAT_OBJECT,
        },
        insights: {
            key: 'insights',
            direction: NodeConnectionDirection.OUTPUT,
            valueType: BuilderValueType.OBJECT,
            required: false,
            minConnections: 0,
            compatibleValueTypes: DS_COMPAT_OBJECT,
        },
        recentMedia: {
            key: 'recentMedia',
            direction: NodeConnectionDirection.OUTPUT,
            valueType: BuilderValueType.ARRAY,
            required: false,
            minConnections: 0,
            compatibleValueTypes: [BuilderValueType.ARRAY, BuilderValueType.ANY],
        },
    },
};

/** Map ports to seed `nodePoint`-compatible plain objects (label uses same key for en/ar). Order follows object key insertion order. */
export function connectionPortsToSeedPortShapes(
    ports: Record<string, DataSourceConnectionPort>,
): Array<Record<string, unknown>> {
    return Object.values(ports).map(p => ({
        key: p.key,
        direction: p.direction,
        label: { defaultLanguage: 'en', values: { en: p.key, ar: p.key } },
        valueType: p.valueType,
        required: p.required,
        minConnections: p.minConnections,
        compatibleValueTypes: p.compatibleValueTypes,
        ...(p.compatibleNodeKinds?.length ? { compatibleNodeKinds: p.compatibleNodeKinds } : {}),
        ...(p.compatibleNodeTypeKeys?.length ? { compatibleNodeTypeKeys: p.compatibleNodeTypeKeys } : {}),
        ...(p.maxConnections !== undefined && p.maxConnections !== null
            ? { maxConnections: p.maxConnections }
            : {}),
    }));
}
