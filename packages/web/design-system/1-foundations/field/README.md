# @papit/field

An extensible base class for form field web components. Handles constraint validation errors, optional warnings, and a multi-step translation fallback chain — so subclasses and wrapper usages both get consistent, accessible form feedback out of the box.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-1--foundations-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/field.svg?logo=npm)](https://www.npmjs.com/package/@papit/field)

---

## Installation

```bash
npm install @papit/field
```

### Use as an HTML wrapper

```html
<script type="module" defer>
  import "@papit/field";
</script>

<pap-field>
  <input type="email" name="email" required />
</pap-field>
```

### Extend in TypeScript

```ts
import { Field } from "@papit/field";

class MyInput extends Field {
  render() {
    return html`
      <input data-target type="text" name="${this.getAttribute("name")}" />
      ${this.renderStates()}
    `;
  }
}

customElements.define("my-input", MyInput);
```

---

## API

### Properties

| Property       | Type                                                                     | Default | Description                                                                                           |
| -------------- | ------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------- |
| `error`        | `Partial<Record<keyof ValidityState \| string, string \| () => string>>` | `{}`    | Custom error messages keyed by `ValidityState` property name or a `setCustomValidity` string.         |
| `warning`      | `Partial<Record<keyof ValidityState \| string, string \| () => string>>` | `{}`    | Custom warning messages. Warnings appear when the field is **valid** and never block form submission. |
| `errorState`   | `Partial<Record<keyof ValidityState, string>>`                           | `{}`    | _(context, rerender)_ Resolved error messages currently active. Read by descendant components.        |
| `warningState` | `Partial<Record<keyof ValidityState, string>>`                           | `{}`    | _(context, rerender)_ Resolved warning messages currently active. Read by descendant components.      |

### CSS Parts

| Part       | Element | Description                                        |
| ---------- | ------- | -------------------------------------------------- |
| `errors`   | `<ul>`  | Container for active error messages.               |
| `error`    | `<li>`  | Individual error item. Also has `data-key` attr.   |
| `warnings` | `<ul>`  | Container for active warning messages.             |
| `warning`  | `<li>`  | Individual warning item. Also has `data-key` attr. |

### Protected methods

| Method           | Description                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderStates()` | Returns the error/warning lists as a template. Call this from a subclass `render()` to position the lists. Returns `null` when both states are empty. |

---

## Error & Warning message resolution

For each truthy `ValidityState` key, the message is resolved in this priority order:

1. **Explicit prop** — value in the `error` / `warning` prop for that key
2. **`customError` sub-key** — when the key is `customError`, the raw `validationMessage` string is used as a lookup key through steps 1, 3, and 4
3. **Field-scoped translation** — `fields.<fieldName>.error.<key>` (or `warning`)
4. **Global translation** — `fields.global.<key>`
5. **Fallback** — the raw key string for errors; empty string (hidden) for warnings

The `fieldName` used in translation lookups resolves as:

1. `name` attribute on `<pap-field>` itself
2. `name` attribute on the wrapped form control
3. Empty string (disables field-scoped lookups)

### Translation file example

```json
{
  "fields": {
    "global": {
      "valueMissing": "This field is required.",
      "tooShort": "Value is too short."
    },
    "email": {
      "error": {
        "typeMismatch": "Please enter a valid email address."
      },
      "warning": {
        "tooShort": "Longer passwords are more secure."
      }
    }
  }
}
```

---

## Errors vs Warnings

| Concern        | Trigger                                               | Blocks submission |
| -------------- | ----------------------------------------------------- | ----------------- |
| `errorState`   | Native `invalid` event (constraint validation failed) | Yes               |
| `warningState` | `change` event **when the field is valid**            | No                |

Because `invalid` only fires for form-blocking failures, errors and warnings are always mutually exclusive at any point in time.

---

## Contributing

Contributions are welcome! Please follow the development guidelines and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 — Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Related

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core) — core utilities, decorators, and base component class
- [@papit/translator](https://github.com/onkelhoy/papit/tree/main/packages/system/translator) — signal-reactive translation singleton used for the message fallback chain

## Support

For issues, questions, or contributions visit the [GitHub repository](https://github.com/onkelhoy/papit).
