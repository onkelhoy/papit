import { computed, effect, signal } from "@papit/signals/node";
import { getTranslator as getCore } from "translator";
import { LanguageJson, TransalatorFn } from "types";

export type { LanguageJson, TransalatorFn } from "types";

const { t, add, change, locale, subscribe, current, list } = getCore(signal, effect, computed);

export const translator = {
    list,
    add,
    change,
    locale,
    subscribe,
    current,
}

export function useTranslator(scope?: string) {
    const translate: TransalatorFn = (key: string, variables?: Record<string, unknown>) => t(scope ? `${scope}.${key}` : key, variables);
    return {
        translate,
        t: translate,
    }
}
