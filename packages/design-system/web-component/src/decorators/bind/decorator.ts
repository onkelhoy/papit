/**
 * @fileoverview `@bind` method decorator for permanently binding a class method's `this` context
 * to the instance on first access.
 *
 * @details
 * **Key Features:**
 * - Lazily binds the method the first time it is accessed.
 * - Replaces the original property with the bound version for subsequent calls.
 * - Ensures that `this` always refers to the instance, even when the method is passed around.
 * - Avoids re-binding on every call, improving performance.
 *
 * @example
 * ```ts
 * class ButtonHandler {
 *   @bind
 *   onClick() {
 *     console.log("Clicked!", this);
 *   }
 * }
 *
 * const handler = new ButtonHandler();
 * const fn = handler.onClick;
 * document.addEventListener("click", fn); // Still works with correct `this`
 * ```
 *
 * @remarks
 * This decorator is useful when:
 * - Passing methods as callbacks to event listeners.
 * - Working with APIs that lose context when storing a reference to a method.
 *
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-11
 */

export function bind<T>(
  _target: Object,
  propertyKey: PropertyKey,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> {
  const original = descriptor.value as unknown as Function;
  return {
    configurable: true,
    get() {
      const boundFn = original.bind(this);
      Object.defineProperty(this, propertyKey, {
        value: boundFn,
        configurable: true,
        writable: true
      });
      return boundFn;
    }
  } as TypedPropertyDescriptor<T>;
}
