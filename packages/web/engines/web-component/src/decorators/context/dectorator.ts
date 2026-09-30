import type { Setting } from "./types";
import { findTarget } from "functions/find-target";

const defaultSettings: Partial<Setting> = {
    rerender: true,
    verbose: false,
};

export function context(settings: Partial<Setting>): PropertyDecorator;
export function context(target: Object, propertyKey: PropertyKey): void;

export function context(
    targetOrSettings: Object | Partial<Setting>,
    maybeKey?: PropertyKey
): void | PropertyDecorator {
    if (typeof maybeKey === "string" || typeof maybeKey === "symbol")
    {
        define(targetOrSettings as Object, maybeKey, {});
        return;
    }

    const settings = targetOrSettings as Partial<Setting>;
    return function (target: Object, key: PropertyKey) {
        define(target, key, settings);
    };
}

function define(target: any, propertyKey: PropertyKey, _settings: Partial<Setting>): void {
    const settings = {
        ...defaultSettings,
        name: propertyKey,
        attribute: propertyKey,
        ..._settings,
    };

    // the marker placed on *this* element so parent-walking skips consumers
    const subcontextKey = `${String(settings.name)}_subcontext`;
    // cleanup handle stored per-instance
    const cleanupKey = Symbol(`__ctx_cleanup_${String(settings.name)}`);

    const originalConnected = target.connectedCallback;
    const originalDisconnected = target.disconnectedCallback;

    target.connectedCallback = function () {
        this[subcontextKey] = true;
        if (originalConnected) originalConnected.call(this);

        queueMicrotask(() => {
            if (!this.isConnected) return;

            const contextowener = findTarget(this, settings.query, target => {
                const hasProperty = String(settings.name) in target && !(subcontextKey in target);
                const hasAttribute =
                    settings.attribute &&
                    target.hasAttribute(String(settings.attribute)) &&
                    !(subcontextKey in target);

                if (hasProperty || hasAttribute) return target;
                return null;
            }) as any;

            if (!contextowener) 
            {
                if (settings.verbose) console.warn(`[context] provider for '${String(settings.name)}' not found`);
                return;
            }

            if (settings.verbose) console.log(`[context] found provider`, contextowener);

            const update = () => {
                let next: any;

                if (String(settings.name) in contextowener)
                {
                    next = contextowener[String(settings.name)];
                }
                else if (settings.attribute && contextowener.hasAttribute(String(settings.attribute)))
                {
                    next = contextowener.getAttribute(String(settings.attribute));
                }

                if (typeof settings.update === "function")
                {
                    (settings.update as Function).call(this, next);
                }

                this[propertyKey] = next;

                // ✅ Reflect back to attribute on the consumer too
                if (settings.attribute && settings.applyattribute)
                {
                    this.setAttribute(String(settings.attribute), String(next ?? ""));
                }

                if (settings.rerender) this.requestUpdate?.();
            };

            update();

            contextowener.addEventListener(`context-${String(settings.name)}`, update);
            contextowener.addEventListener("context-manual-change", update);

            let observer: MutationObserver | null = null;

            if (settings.attribute && !(String(settings.name) in contextowener))
            {
                observer = new MutationObserver(update);
                observer.observe(contextowener, {
                    attributes: true,
                    attributeFilter: [String(settings.attribute)],
                });
            }

            this[cleanupKey] = () => {
                contextowener.removeEventListener(`context-${String(settings.name)}`, update);
                contextowener.removeEventListener("context-manual-change", update);
                observer?.disconnect();
            };
        });
    };

    target.disconnectedCallback = function () {
        this[cleanupKey]?.();
        this[cleanupKey] = null;
        if (originalDisconnected) originalDisconnected.call(this);
    };
}