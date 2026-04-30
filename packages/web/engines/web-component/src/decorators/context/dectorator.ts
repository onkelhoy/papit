import { nextParent } from "functions/next-parent";
import type { Setting } from "./types";

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

            let parent = nextParent(this) as any;

            while (parent)
            {
                const hasProperty = String(settings.name) in parent && !(subcontextKey in parent);
                const hasAttribute =
                    settings.attribute &&
                    parent.hasAttribute(String(settings.attribute)) &&
                    !(subcontextKey in parent);

                if (hasProperty || hasAttribute) break;

                if (parent === document.documentElement)
                {
                    parent = null;
                    break;
                }

                parent = nextParent(parent);
            }

            if (!parent)
            {
                if (settings.verbose)
                {
                    console.warn(`[context] provider for '${String(settings.name)}' not found`);
                }
                return;
            }

            if (settings.verbose) console.log(`[context] found provider`, parent);

            const update = () => {
                if (settings.verbose) console.log(`[context] update '${String(settings.name)}'`);

                let next: any;

                if (String(settings.name) in parent)
                {
                    next = parent[String(settings.name)];
                } else if (settings.attribute && parent.hasAttribute(String(settings.attribute)))
                {
                    next = parent.getAttribute(String(settings.attribute));
                }

                this[propertyKey] = next;
                if (settings.rerender) this.requestUpdate?.();
            };

            update();

            parent.addEventListener(`context-${String(settings.name)}`, update);
            parent.addEventListener("context-manual-change", update);

            let observer: MutationObserver | null = null;

            if (settings.attribute && !(String(settings.name) in parent))
            {
                observer = new MutationObserver(update);
                observer.observe(parent, {
                    attributes: true,
                    attributeFilter: [String(settings.attribute)],
                });
            }

            this[cleanupKey] = () => {
                parent.removeEventListener(`context-${String(settings.name)}`, update);
                parent.removeEventListener("context-manual-change", update);
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