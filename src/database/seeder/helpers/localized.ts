import { LocalizedSeed } from '../types';

/**
 * Factory for creating localized seed values.
 * Kept in TypeScript so we can call it from code; JSON data stores the
 * expanded shape directly.
 */
export const localized = (en: string, ar?: string): LocalizedSeed => ({
    defaultLanguage: 'en',
    values: ar ? { en, ar } : { en },
});
