/**
 * @fileoverview Provides the `@query` decorator for automatically wiring
 * up DOM element references in `CustomElement` subclasses.
 *
 * The decorator stores metadata (selector, load callback, property key)
 * that is later used by `CustomElement`'s `findQueries()` method to
 * populate decorated properties.
 *
 * @author Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-11
 */

import { QueryMeta } from "../../element/types";
import { Setting } from "./types";

/**
 * A property decorator that registers a DOM query for the decorated property.
 *
 * Can be used in two forms:
 * - `@query` with no arguments → property name is used as selector
 * - `@query('selector')` or `@query({ selector: '...', load: el => {} })`
 *
 * When the component updates, the matching element is assigned to the property.
 *
 * @template T The type of the element being queried (defaults to `HTMLElement`).
 * @param settings Either a selector string, a partial `Setting<T>`, or omitted.
 */
export function query<T extends Element = HTMLElement>(settings: string | Partial<Setting<T>>): PropertyDecorator;

/**
 * Overload for decorator used without arguments.
 * @param target The prototype of the class.
 * @param propertyKey The name of the property.
 */
export function query(target: Object, propertyKey: PropertyKey): void;

export function query<T extends Element = HTMLElement>(
  targetOrSettings: Object | string | Partial<Setting<T>>,
  propertyKey?: PropertyKey
): void | PropertyDecorator {
  // @query — no args
  if (propertyKey) {
    define<T>(targetOrSettings as Object, propertyKey, {});
    return; // void → valid for this overload
  }

  // @query({...}) — with config
  const settings: Partial<Setting<T>> =
    typeof targetOrSettings === "string"
      ? { selector: targetOrSettings }
      : (targetOrSettings as Partial<Setting<T>>);

  return function (target: Object, key: PropertyKey) {
    define<T>(
      target, 
      key, 
      settings,
    );
  };
}

function define<T extends Element = HTMLElement>(target: any, propertyKey: PropertyKey, settings: Partial<Setting<T>>): void {
  const selector = String(settings.selector ?? propertyKey);
  
  // Always store on target
  const meta: QueryMeta[] = target.queryMeta ??= [];
  meta.push({ selector, load: settings.load, propertyKey });
}