import { computed, effect, signal } from "@papit/signals";
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
 * Translate function bound to the current language. With `scope`, keys are prefixed with
 * `scope.`. Missing keys return the key; `{name}` placeholders are filled from `variables`.
 */
export function useTranslator(scope?: string) {
    const translate: TransalatorFn = (key: string, variables?: Record<string, unknown>) => t(scope ? `${scope}.${key}` : key, variables);
    return translate;
}

type UpdateFn = (this: any) => void;

interface TranslateSetting {
    update?: UpdateFn;
}

const DISPOSE = Symbol("translate_dispose");

/**
 * Field decorator that re-renders a component when the language changes. Subscribes on
 * `connectedCallback`, unsubscribes on `disconnectedCallback`, and calls `requestUpdate()`
 * plus the optional `update` hook on each change (and `update` on connect when a language is set).
 *
 * @example
 * class MyComponent extends CustomElement {
 *     @translate t = useTranslator();
 *     // or: @translate({ update(this: MyComponent) { this.updateLabels(); } })
 * }
 *
 * @author Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-11
 */
export function translate(target: Object, propertyKey: PropertyKey): void;
export function translate(settings: TranslateSetting): PropertyDecorator;
export function translate(
    targetOrSettings: Object | TranslateSetting,
    propertyKey?: PropertyKey
): void | PropertyDecorator {
    if (propertyKey !== undefined)
    {
        define(targetOrSettings as Object, propertyKey, {});
        return;
    }

    const settings = targetOrSettings as TranslateSetting;
    return (target: Object, key: PropertyKey) => define(target, key, settings);
}

function define(target: any, propertyKey: PropertyKey, settings: TranslateSetting): void {
    const originalConnected = target.connectedCallback;
    target.connectedCallback = function () {
        originalConnected?.call(this);
        if (settings.update && translator.current()) settings.update.call(this);

        this[DISPOSE] = translator.subscribe(() => {
            this.requestUpdate?.();
            settings.update?.call(this);
        });
    };

    const originalDisconnected = target.disconnectedCallback;
    target.disconnectedCallback = function () {
        originalDisconnected?.call(this);
        this[DISPOSE]?.();
    };
}