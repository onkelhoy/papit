/**
 * @fileoverview Utility function `debounceFn` that delays the execution of a function
 * until a specified delay has passed since the last time it was invoked.
 *
 * @details
 * **Behavior:**
 * - Resets the timer on each call, ensuring that the wrapped function only executes
 *   after `delay` milliseconds have passed without another call.
 * - Preserves the original `this` context of the wrapped function.
 * - Clears the timer after execution to avoid memory leaks.
 *
 * @typeParam T - The function type being debounced.
 *
 * @param execute - The function to debounce.
 * @param delay - The wait time in milliseconds before executing `execute`.
 *   Defaults to `STANDARD_DELAY`.
 *
 * @returns A debounced version of the provided function.
 *
 * @example
 * ```ts
 * const log = debounceFn((msg: string) => console.log(msg), 300);
 * log("Hello");
 * log("World");
 * // Only "World" will be logged after 300ms
 * ```
 *
 * @remarks
 * This is the low-level function used by higher-level decorators such as `@debounce`.
 * Use this directly for cases where you don't need a decorator.
 *
 * @see {@link STANDARD_DELAY} for the default delay value.
 *
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-11
 */


import { STANDARD_DELAY } from "./constants";

export function Function<T extends (...args: any[]) => any>(
  execute: T,
  delay: number = STANDARD_DELAY
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      execute.apply(this, args);
      timer = null;
    }, delay);
  };
}