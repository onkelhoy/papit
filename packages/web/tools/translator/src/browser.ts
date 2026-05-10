import { computed, effect, signal } from "@papit/signals";
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
    return translate;
}

type UpdateFn = (this: any) => void;

interface TranslateSetting {
    update?: UpdateFn;
}

/**
 * `@translate` field decorator for automatically subscribing a class instance
 * to translator updates and triggering re-renders when the active language changes.
 *
 * @details
 * **Key Features:**
 * - Subscribes to the global `translator` on `connectedCallback` and unsubscribes on `disconnectedCallback`.
 * - Calls `requestUpdate()` on language change — no manual wiring required.
 * - Works with scoped translators: the closure created by `useTranslator(scope?)` is preserved as-is.
 * - Does not re-assign the field on language change; the function returned by `useTranslator`
 *   already delegates to the current global `t`, so the closure stays valid across language switches.
 * - Optionally accepts a settings object for additional hooks (e.g. `update`).
 *
 * @example
 * ```ts
 * // Basic usage — reactive re-renders only
 * class MyComponent extends CustomElement {
 *   @translate t = useTranslator();
 * }
 * ```
 *
 * @example
 * ```ts
 * // With update callback — called on connect (if lang already active) and on every language change
 * class MyComponent extends CustomElement {
 *   @translate({ update(this: MyComponent) { this.updateLabels(); } })
 *   t = useTranslator();
 * }
 * ```
 *
 * @remarks
 * This decorator is useful when:
 * - You need reactive translations inside a web component without managing subscriptions manually.
 * - You want scoped translation keys without repeating the scope prefix at every call site.
 * - You need a side-effect hook (e.g. updating ARIA labels) whenever the language changes.
 *
 * The type of the decorated field is inferred from the `useTranslator()` initializer,
 * so no explicit type annotation is needed.
 *
 * @author Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-11
 */
const DISPOSE = Symbol("translate_dispose");

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