# CustomElementInternals Base Class

> File: `docs/custom-element-internals.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

---

## Introduction

The `CustomElementInternals` base class extends [`CustomElement`](./custom-element.md) with **Form-associated Custom Elements** (FACE) support via [`ElementInternals`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals).

This enables:
- Native form participation (`formAssociated = true`)
- Synchronization with `<form>` behavior (submission, reset, validation)
- Accessibility through `aria-disabled` integration
- Easy property binding for disabled state
- Control over element validity and error messages

This is ideal for building **custom inputs, switches, sliders, and any other form control** that should behave like a native HTML form element.

---

## 1. Class Structure

```ts
export class CustomElementInternals extends CustomElement {
  static formAssociated = true;

  protected _internals: ElementInternals;

  @property({ rerender: false, type: Boolean, aria: 'aria-disabled', removeAttribute: true })
  disabled?: boolean;

  constructor(setting?: Partial<Setting>) { ... }

  protected formDisabledCallback(disabled: boolean) { ... }
  protected formAssociatedCallback(form: HTMLFormElement) { ... }
  protected formStateRestoreCallback(state: any, mode: any) { ... }

  protected checkValidity(): boolean { ... }
  protected reportValidity(): boolean { ... }
  protected setValidity(flags?: ValidityStateFlags, message?: string, anchor?: HTMLElement) { ... }
}
````

---

## 2. Form Association

The class sets:

```ts
static formAssociated = true;
```

This signals the browser that your custom element:

* Can be placed inside a `<form>`
* Will participate in submission and reset events
* Can provide custom validation logic

Internally, it calls:

```ts
this._internals = this.attachInternals();
```

The `ElementInternals` object stores validity state, form value, and accessibility properties.

---

## 3. Reactive `disabled` Property

The `disabled` property:

```ts
@property({ rerender: false, type: Boolean, aria: 'aria-disabled', removeAttribute: true })
disabled?: boolean;
```

Behaves as:

* Boolean type → coerced to `true`/`false`
* Syncs with `aria-disabled` for accessibility
* Automatically removed from DOM when `false`
* Does **not** trigger re-renders (`rerender: false`) to avoid unnecessary DOM updates

The value is updated when:

* The form disables the element via `formDisabledCallback()`
* You set `this.disabled = true` manually

---

## 4. Lifecycle Hooks for Forms

`CustomElementInternals` implements **form lifecycle callbacks**:

| Method                                            | When Called                                               | Purpose                         |
| ------------------------------------------------- | --------------------------------------------------------- | ------------------------------- |
| `formDisabledCallback(disabled: boolean)`         | The element's `disabled` state changes due to form state  | Sync internal disabled property |
| `formAssociatedCallback(form: HTMLFormElement)`   | The element becomes associated with a form                | Setup related form logic        |
| `formStateRestoreCallback(state: any, mode: any)` | Browser restores form state (e.g., after back navigation) | Restore element's value         |

---

## 5. Validation Methods

Built-in wrappers for validation:

```ts
protected checkValidity(): boolean
protected reportValidity(): boolean
protected setValidity(flags?: ValidityStateFlags, message?: string, anchor?: HTMLElement)
```

### Example

```ts
this.setValidity({ valueMissing: true }, "This field is required");
if (!this.checkValidity()) {
  this.reportValidity();
}
```

These map directly to the native [`ElementInternals`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals) API.

---

## 6. Usage Example

```ts
import { html } from "@papit/web-component/html";
import { CustomElementInternals } from "@papit/web-component/custom-element-internals";
import { property } from "@papit/web-component/decorators";

class MyInput extends CustomElementInternals {
  @property({ type: String }) value = "";

  render() {
    return html`
      <input
        .value=${this.value}
        ?disabled=${this.disabled}
        @input=${(e: InputEvent) => {
          this.value = (e.target as HTMLInputElement).value;
          this._internals.setFormValue(this.value);
        }}
      >
    `;
  }
}

customElements.define("my-input", MyInput);
```

---

## 7. Integration Tips

* Always call `this._internals.setFormValue()` to set the value submitted with the form
* Use `setValidity()` to show error messages before submission
* Combine with `@property` decorators for reactivity
* Works with both `shadowRoot` and light DOM

---

## 8. Related Links

* [MDN: ElementInternals API](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)
* [CustomElement](./custom-element.md)
* [HTML Tagged Templates](./html/README.md)
* [Parts System](./parts.md)
* [Decorators](./decorators/README.md)
