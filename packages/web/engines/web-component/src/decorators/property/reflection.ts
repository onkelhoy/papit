/**
 * @fileoverview Deferred attribute reflection for `@property`.
 *
 * The custom elements spec forbids adding attributes while an element is being
 * constructed (`document.createElement` throws "The result must not have attributes").
 * Property defaults run through the setter during construction, so their reflection is
 * queued here and flushed once the element connects.
 */

const PENDING = Symbol("papit.pendingReflections");
const CONNECTED = Symbol("papit.hasConnected");

type Reflector = (this: any) => void;

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

/** Marks the element as connected and runs every queued reflection. */
export function flushReflections(element: any): void {
    element[CONNECTED] = true;

    const pending: Map<PropertyKey, Reflector> | undefined = element[PENDING];
    if (!pending) return;
    element[PENDING] = undefined;

    for (const reflect of pending.values()) reflect.call(element);
}
