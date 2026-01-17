/**
 * @fileoverview Implements the `@property` decorator for defining reactive properties
 * on custom elements. Supports attribute-property reflection, change callbacks, 
 * before/after hooks, and re-render triggers.
 *
 * @details
 * - Properties can be bound to attributes for automatic synchronization.
 * - Internal update prevention avoids infinite reflection loops.
 * - Supports type conversion for String, Number, Boolean, and JSON-serializable values.
 * - Includes deep equality checking to avoid redundant updates.
 *
 * @author Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-11
 */

import { parseValue, sameValue, stringifyValue } from "../../functions/value";
import { PropertyMeta } from "../../element/types";
import { resolve } from "../../functions/resolve";
import { Setting } from "./types";

const defaultSettings: Partial<Setting> = {
  readonly: false,
  rerender: false,
  maxReqursiveSteps: 20,
  removeAttribute: true,
  attribute: true,
};

/**
 * A property decorator for defining reactive properties on a custom element.
 *
 * Can be used in two forms:
 * - `@property` with no arguments → default settings applied.
 * - `@property({...})` → pass custom settings such as `attribute`, `type`, `before`, `after`, etc.
 *
 * @param settings Partial settings object controlling reflection, hooks, and behavior.
 */
export function property(settings: Partial<Setting>): PropertyDecorator;
/**
 * Overload for decorator used without arguments.
 *
 * @param target The prototype of the class.
 * @param propertyKey The property name.
 */
export function property(target: Object, propertyKey: PropertyKey): void;

export function property(
  targetOrSettings: Object | Partial<Setting>,
  maybeKey?: PropertyKey
): void | PropertyDecorator {
  // @property — no args
  if (typeof maybeKey === "string" || typeof maybeKey === "symbol")
  {
    define(targetOrSettings as Object, maybeKey, {});
    return; // void → valid for this overload
  }

  // @property({...}) — with config
  const settings = targetOrSettings as Partial<Setting>;
  return function (target: Object, key: PropertyKey) {
    define(target, key, settings);
  };
}

function define(target: any, propertyKey: PropertyKey, _settings: Partial<Setting>): void {
  const privateKey = `__${String(propertyKey)}`;
  const updateKey = Symbol(`${String(propertyKey)}_internalUpdate`);

  const settings = { ...defaultSettings, ..._settings };
  let attributeName: string | null = null;
  // let updateKey = false;

  if (settings.attribute)
  {
    attributeName = typeof settings.attribute === "string" ? settings.attribute : String(propertyKey);

    const ctor = target.constructor as any;

    // ensure observedAttributes getter exists
    if (!Array.isArray(ctor._observedAttributes)) ctor._observedAttributes = [];
    ctor._observedAttributes.push(attributeName);

    if (!Object.getOwnPropertyDescriptor(ctor, "observedAttributes"))
    {
      Object.defineProperty(ctor, "observedAttributes", {
        get() { return ctor._observedAttributes; }
      });
    }

    const meta: PropertyMeta = target.propertyMeta ??= new Map();
    meta.set(attributeName, function (this: any, newValue, oldValue) {
      if (this[updateKey])
      {
        this[updateKey] = false;
        return;
      }

      const nvalue = parseValue(newValue, settings.type);
      if (settings.hasChanged && !settings.hasChanged(nvalue, this[propertyKey])) return;
      if (sameValue(nvalue, this[propertyKey], settings.maxReqursiveSteps)) return;

      this[updateKey] = true;
      this[propertyKey] = nvalue; // assign directly
      this[updateKey] = false;
    });
  }

  Object.defineProperty(target, propertyKey, {
    configurable: settings.configurable ?? true,
    enumerable: settings.enumerable ?? true,
    get() {
      const data = this[privateKey];
      return settings?.get ? settings.get.call(this, data) : data;
    },
    async set(value) {
      const isInitial = !Object.hasOwn(this, privateKey);

      let initialAttribute = false;
      if (isInitial && attributeName && this.hasAttribute(attributeName))
      {
        // parse existing attribute immediately
        value = parseValue(this.getAttribute(attributeName), settings.type);
        initialAttribute = true;
      }

      if (settings.readonly && !isInitial)
      {
        throw new TypeError(`Cannot reassign readonly property '${String(propertyKey)}'`);
      }

      if (settings.set) 
      {
        value = await resolve(settings.set(value));
      }

      const oldVal = this[privateKey];
      if (settings.hasChanged && !settings.hasChanged(value, oldVal)) return;
      else if (sameValue(value, oldVal, settings.maxReqursiveSteps)) return;

      const valuestring = stringifyValue(value, settings.type);
      if (settings.aria) this.setAttribute(settings.aria, valuestring);

      if (settings.before) settings.before.call(this, value, oldVal, isInitial, false);

      this[privateKey] = value;

      if (!initialAttribute && attributeName && settings.reflect !== false && !this[updateKey])
      {
        this[updateKey] = true;
        if (settings.removeAttribute && (value === null || value === undefined || value === false))
        {
          this.removeAttribute(attributeName);
        }
        else
        {
          this.setAttribute(attributeName, valuestring);
        }
      }
      this[updateKey] = false;

      if (settings.after) settings.after.call(this, value, oldVal, isInitial, false);
      if (!isInitial && settings.rerender) this.requestUpdate?.();
      if (settings.context) this.dispatchEvent(new Event(`context-${String(propertyKey)}`));
    },
  });
}
