import { computed, effect, signal } from "@papit/signals/node";
import { getTranslator as getCore } from "translator";
import { LanguageJson, TransalatorFn } from "types";

export type { LanguageJson, TransalatorFn } from "types";

const { t, add, change, locale, subscribe, current, list } = getCore(signal, effect, computed);

/**
 * The shared translation store. `add` registers a language, `change` makes one current
 * (fetching its `url` on first use), and `subscribe` runs a callback on every later change.
 * `list`, `locale` and `current` are signal readers.
 */
export const translator = {
    list,
    add,
    change,
    locale,
    subscribe,
    current,
}

/**
 * Translate function bound to the current language, as `{ translate, t }`. With `scope`,
 * keys are prefixed with `scope.`.
 */
export function useTranslator(scope?: string) {
    const translate: TransalatorFn = (key: string, variables?: Record<string, unknown>) => t(scope ? `${scope}.${key}` : key, variables);
    return {
        translate,
        t: translate,
    }
}
