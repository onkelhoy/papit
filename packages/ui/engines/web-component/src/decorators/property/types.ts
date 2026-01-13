import { Resolvable } from "../../functions/resolve";

export type Setting<T = any> = {
  /**
   * Enables verbose logging for this property — useful during development or debugging.
   */
  verbose: boolean;

  /**
   * Synchronize this property with a corresponding ARIA attribute.
   * Great for enhancing accessibility (e.g., aria-label, aria-pressed).
   */
  aria: string;

  /**
   * When true, triggers a re-render of the component when the property changes.
   * Essential for reactive UIs.
   */
  rerender: boolean;

  /**
   * Fires a custom event (e.g., `${property}-changed`) when the property changes.
   */
  notify: boolean;

  /**
   * Marks the property as part of the component's context system.
   * Useful for dependency injection or shared state.
   */
  context: boolean;

  /**
   * Sync this property with an HTML attribute.
   * - `true`: uses the same name as the property.
   * - `string`: uses the provided name as the attribute.
   */
  attribute: boolean | string;

  /**
   * If true, removes the attribute from the DOM when the property is falsy (e.g., `false`, `null`, `undefined`).
   * Especially useful for toggle-like attributes such as `disabled`, `hidden`, or `checked`.
   */
  removeAttribute: boolean;

  /**
   * Reflects property changes back to the attribute.
   * For example, changing a property programmatically updates the corresponding HTML attribute.
   */
  reflect: boolean;

  /**
   * A type function (e.g., `String`, `Number`, `Boolean`) used to coerce attribute values into the desired type.
   * For example, turns `"123"` into `123` if `type: Number`.
   */
  type: Function;

  /**
   * Makes the property read-only. Any external assignment will be ignored or throw in strict mode.
   */
  readonly: boolean;

  /**
   * Whether the property descriptor can be redefined later.
   * Part of the standard property descriptor behavior.
   */
  configurable: boolean;

  /**
   * Whether the property will show up in object property enumerations like `Object.keys()` or `for...in`.
   */
  enumerable: boolean;

  /**
   * If true, disables generation of accessors (getter/setter) and directly defines the property.
   * Useful for static or internal properties that don't need tracking.
   */
  noAccessor: boolean;

  /**
   * maxReqursiveSteps is for values that is deeply nested objects|arrays 
   * Use this to increase the default (20) reqursive steps a value will try before throwing an error
   */
  maxReqursiveSteps: number;

  /**
   * Lifecycle hook triggered when the property changes.
   * Receives the new and previous values.
   */
  observer(newVal: T, oldVal: T): void;

  /**
   * Custom change detection function.
   * Return `true` to trigger an update; `false` to skip it (e.g., shallow or deep compare).
   */
  hasChanged(newVal: T, oldVal: T): boolean;

  /**
   * Custom setter logic.
   * ⚠️ Called every time a value is set, regardless of whether it changed. Use cautiously.
   */
  set(value: Resolvable<T>): Resolvable<T>;

  /**
   * Custom getter logic.
   * Used to transform the value when the property is accessed.
   */
  get(value: T): T;

  /**
   * Hook called just before the value is set.
   * Useful for validation, logging, or mutation.
   */
  before(value: T, old: T, initial: boolean, attributeUpdate: boolean): void;

  /**
   * Hook called immediately after the value is set.
   * Receives the new value and the previous value.
   * Useful for triggering side effects like re-renders or DOM updates.
   */
  after(value: T, old: T, initial: boolean, attributeUpdate: boolean): void;
}