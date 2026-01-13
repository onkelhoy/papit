/**
 * @fileoverview `@debounce` method decorator for deferring method execution
 * until a defined period of inactivity has passed since the last call.
 *
 * @details
 * **Key Features:**
 * - Flexible syntax:
 *   - `@debounce` — uses a standard delay.
 *   - `@debounce(200)` — custom numeric delay in milliseconds.
 *   - `@debounce("customName")` — assigns the debounced version to a different property name.
 *   - `@debounce({ delay: 200, name: "customName" })` — full configuration control.
 * - If `name` is provided:
 *   - The original method remains untouched.
 *   - The debounced method is attached as a separate property.
 * - Ideal for rate-limiting high-frequency methods such as resize, scroll, or search handlers.
 *
 * @requires debounceFn — core debouncing function.
 * @requires STANDARD_DELAY — default debounce delay in milliseconds.
 *
 * @example
 * ```ts
 * class Search {
 *   @debounce(300)
 *   onSearch() {
 *     console.log("Search triggered");
 *   }
 * }
 *
 * const search = new Search();
 * search.onSearch(); // Will run only after 300ms of no further calls
 * ```
 *
 * @example
 * ```ts
 * class FormHandler {
 *   @debounce({ delay: 500, name: "submitDebounced" })
 *   submit() {
 *     console.log("Form submitted");
 *   }
 * }
 *
 * const form = new FormHandler();
 * form.submit();           // immediate
 * form.submitDebounced();  // debounced by 500ms
 * ```
 *
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-11
 */

import { debounceFn, STANDARD_DELAY } from "../../functions/debounce";
import { Options } from "./types";

/**
 * Debounce a class method.
 *
 * @overload
 * @returns Method decorator with standard delay.
 */
export function debounce(): MethodDecorator;

/**
 * @overload
 * @param delay Delay in milliseconds before the method is invoked.
 */
export function debounce(delay: number): MethodDecorator;

/**
 * @overload
 * @param name Alternative property name for the debounced function.
 */
export function debounce(name: string): MethodDecorator;

/**
 * @overload
 * @param options Partial options object with `delay` and/or `name`.
 */
export function debounce(options: Partial<Options>): MethodDecorator;

/**
 * @overload
 * Standard method decorator signature.
 */
export function debounce(
  target: any,
  propertyKey: PropertyKey,
  descriptor: PropertyDescriptor
): void;


export function debounce(
  ...args:
    | [any, PropertyKey, PropertyDescriptor]
    | [number | string | Partial<Options>]
): MethodDecorator | void {

  // CASE: @debounce

  if (args.length === 3 && typeof args[2] === "object") {
    const [target, key, descriptor] = args;
    return define({ delay: STANDARD_DELAY }, target, key, descriptor);
  }

  // CASE: @debounce(...) (with options)
  const opts = normalizeArgs(args[0]);

  return function (
    target: any,
    key: PropertyKey,
    descriptor: PropertyDescriptor
  ): void {
    define(opts, target, key, descriptor);
  };
}

/**
 * Normalizes arguments into a full `Options` object.
 */
function normalizeArgs(arg: any): Options {
  if (typeof arg === "number") return { delay: arg };
  if (typeof arg === "string") return { delay: STANDARD_DELAY, name: arg };
  return { delay: STANDARD_DELAY, ...arg };
}

/**
 * Applies the debouncing logic to a method descriptor.
 *
 * @param options Debounce configuration.
 * @param target Class prototype.
 * @param key Property key of the original method.
 * @param descriptor Method descriptor.
 */
function define(
  options: Options,
  target: any,
  key: PropertyKey,
  descriptor: PropertyDescriptor
) {
  const original = descriptor.value;
  const debouncedFn = debounceFn(original, options.delay);

  if (options.name) {
    Object.defineProperty(target, String(options.name ?? key), {
      configurable: true,
      enumerable: false,
      writable: true,
      value: debouncedFn,
    });
  } else {
    descriptor.value = debouncedFn;
  }
}