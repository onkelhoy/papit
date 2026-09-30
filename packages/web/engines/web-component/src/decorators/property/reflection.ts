/**
 * @fileoverview Deferred attribute reflection and `after` hooks for `@property`.
 *
 * The custom elements spec forbids adding attributes while an element is being
 * constructed (`document.createElement` throws "The result must not have attributes").
 * Property defaults run through the setter during construction, so their reflection and
 * their `after` hooks (which may touch `style`, `classList`, ...) are queued here and
 * flushed once the element connects.
 */

const PENDING = Symbol("papit.pendingReflections");
const PENDING_AFTER = Symbol("papit.pendingAfter");
const CONNECTED = Symbol("papit.hasConnected");

type Reflector = (this: any) => void;
type After = (this: any) => void;

/** True once the element has connected at least once; reflection is immediate from then on. */
export function hasConnected(element: any): boolean {
    return element[CONNECTED] === true;
}

/** Queues (or replaces) the reflection for `key`; it runs with the value current at flush time. */
export function queueReflection(element: any, key: PropertyKey, reflect: Reflector): void {
    const pending: Map<PropertyKey, Reflector> = element[PENDING] ??= new Map();
    pending.set(key, reflect);
}

/** Drops a queued reflection, e.g. when an attribute set by the user now holds the truth. */
export function cancelReflection(element: any, key: PropertyKey): void {
    (element[PENDING] as Map<PropertyKey, Reflector> | undefined)?.delete(key);
}

/** Queues the `after` hook for `key`; the first queued call is kept, so it sees the original old value. */
export function queueAfter(element: any, key: PropertyKey, after: After): void {
    const pending: Map<PropertyKey, After> = element[PENDING_AFTER] ??= new Map();
    if (!pending.has(key)) pending.set(key, after);
}

/** Marks the element as connected, runs every queued reflection, then every queued `after` hook. */
export function flushReflections(element: any): void {
    element[CONNECTED] = true;

    const pending: Map<PropertyKey, Reflector> | undefined = element[PENDING];
    if (pending)
    {
        element[PENDING] = undefined;
        for (const reflect of pending.values()) reflect.call(element);
    }

    const pendingAfter: Map<PropertyKey, After> | undefined = element[PENDING_AFTER];
    if (pendingAfter)
    {
        element[PENDING_AFTER] = undefined;
        for (const after of pendingAfter.values()) after.call(element);
    }
}
