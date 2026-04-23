export const displaynames = 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'language' })
    : null

export type Language = string & { __brand: "language" };

export type LanguageJson = {
    meta?: {
        language: Language;
        region: string;
    }
    id: string;
} & (
        | { url: string; translations?: { meta?: LanguageJson['meta'] } & Record<string, string> }
        | { url?: never; translations: { meta?: LanguageJson['meta'] } & Record<string, string> }
    )

export function isLanguage(value: string): value is Language {
    if (!displaynames) return false;
    const result = displaynames.of(value);
    return !!result && result !== value;
}
export type TransalatorFn = (key: string, variables?: Record<string, unknown>) => string;
