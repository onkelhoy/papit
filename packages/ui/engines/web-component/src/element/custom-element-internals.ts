/**
 * @file CustomElementInternals
 * @description
 * A base class extending {@link CustomElement} that integrates the
 * [Form-associated custom elements API](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)
 * for building reusable, accessible form controls with minimal boilerplate.
 *
 * Provides:
 * - `ElementInternals` handling via `this.attachInternals()`
 * - Full support for `formAssociated`, `formDisabledCallback`, `formStateRestoreCallback`
 * - Property-decorator integration for reactive `disabled` attribute with ARIA mapping
 * - Wrapper methods for `checkValidity`, `reportValidity`, and `setValidity`
 *
 * @module CustomElementInternals
 * @author Henry Pap
 * @created 2025-08-11
 */

import { property } from "../decorators/property";
import { CustomElement } from "./custom-element";
import { Setting } from "./types";

/**
 * **CustomElementInternals**
 *
 * Extends {@link CustomElement} with built-in support for the
 * [Form-associated custom elements API](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements-face-example)
 * via `ElementInternals`. This enables:
 *
 * - Direct form association (`static formAssociated = true`)
 * - Native form validation methods (`checkValidity`, `reportValidity`, `setValidity`)
 * - Integration with lifecycle form callbacks (`formAssociatedCallback`, `formDisabledCallback`, `formStateRestoreCallback`)
 * - Auto-synced `disabled` state with `aria-disabled`
 *
 * **Usage Example:**
 * ```ts
 * class MyInput extends CustomElementInternals {
 *   render() {
 *     return html`<input ?disabled=${this.disabled}>`;
 *   }
 * }
 * customElements.define('my-input', MyInput);
 * ```
 *
 * @extends CustomElement
 */
export class CustomElementInternals extends CustomElement {
  /** Enables native form association for this element. */
  static formAssociated = true;

  /** Reference to the element's internal form state manager. */
  protected _internals: ElementInternals;

  /**
   * Reactive disabled property.
   * - `rerender: false` → does not trigger a re-render when changed
   * - `type: Boolean` → coerces values to `true`/`false`
   * - `aria: 'aria-disabled'` → syncs to ARIA for accessibility
   * - `removeAttribute: true` → removes `disabled` attribute when false
   */
  @property({ rerender: false, type: Boolean, aria: 'aria-disabled', removeAttribute: true })
  disabled: boolean|undefined = undefined;

  constructor(setting?: Partial<Setting>) {
    super(setting);
    this._internals = this.attachInternals();
  }

  /** Called when the element’s `disabled` state changes via a form. */
  protected formDisabledCallback(disabled: boolean) {
    this.disabled = disabled;
  }

  /** Called when the element is associated with a form. */
  protected formAssociatedCallback(form: HTMLFormElement) {
    console.log('[field]: formAssociatedCallback', form);
  }

  /** Called when the browser restores the form's state (e.g., after page reload). */
  protected formStateRestoreCallback(state: any, mode: any) {
    console.log('[field]: formStateRestoreCallback', { state, mode });
  }

  /** Returns `true` if the element's value satisfies validity constraints. */
  protected checkValidity(): boolean {
    if (this._internals === undefined) return true;
    return this._internals?.checkValidity();
  }

  /** Reports validity and displays any validation message to the user. */
  protected reportValidity(): boolean {
    if (this._internals === undefined) return true;
    return this._internals?.reportValidity();
  }

  /**
   * Sets the validity state of the element.
   * @param flags - Validity state flags object
   * @param message - Optional validation message
   * @param anchor - Optional element to associate with the error
   */
  protected setValidity(
    flags?: ValidityStateFlags | undefined,
    message?: string | undefined,
    anchor?: HTMLElement | undefined
  ) {
    if (!this._internals === undefined) return;
    this._internals.setValidity(flags, message, anchor || undefined);
  }
}
