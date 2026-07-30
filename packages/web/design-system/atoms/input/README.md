# @papit/input

A form-associated text input with optional format masking, password visibility toggle, and a clear button.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/input.svg?logo=npm)](https://www.npmjs.com/package/@papit/input)

---

## Installation

```bash
npm install @papit/input
```

### To use in **html**

```html
<script type="module" defer>
  import "@papit/input";
</script>

<pap-input name="email" type="email" placeholder="you@example.com"></pap-input>
```

## Usage

### Format masking

Use `x` as a placeholder character in `format`. Typed input is inserted into the mask automatically and non-`x` characters are treated as literals.

```html
<pap-input format="(xxx) xxx-xxxx" placeholder="(555) 123-4567"></pap-input>
<pap-input format="xxxx-xxxx-xxxx-xxxx" placeholder="Card number"></pap-input>
```

### Password field

When `type="password"`, an eye icon button is shown to toggle visibility.

```html
<pap-input type="password" name="password"></pap-input>
```

### Clearable

Set `clear` to show a button that resets the value once it's non-empty.

```html
<pap-input clear placeholder="Search..."></pap-input>
```

### Form association

`pap-input` participates in native forms via `ElementInternals`. Setting `defaultvalue` restores that value on `form.reset()`.

```html
<form>
  <pap-input name="username" defaultvalue="guest" required></pap-input>
  <button type="submit">Submit</button>
</form>
```

## Attributes

| Attribute                 | Type                       | Default  | Description                         |
| ------------------------- | -------------------------- | -------- | ----------------------------------- |
| `type`                    | `string`                   | `"text"` | Native input type                   |
| `format`                  | `string`                   | —        | Mask pattern, `x` as placeholder    |
| `value`                   | `string \| number \| Date` | `null`   | Current value                       |
| `defaultvalue`            | `string`                   | —        | Value restored on form reset        |
| `clear`                   | `boolean`                  | `false`  | Show clear button                   |
| `required`                | `boolean`                  | `false`  | Marks field as required             |
| `placeholder`             | `string`                   | —        | Native placeholder                  |
| `min` / `max`             | `number`                   | —        | Native min/max (numeric types)      |
| `minlength` / `maxlength` | `number`                   | —        | Native min/max length               |
| `pattern`                 | `string`                   | —        | Native validation pattern           |
| `accept`                  | `string`                   | —        | Accepted file types (`type="file"`) |
| `autocomplete`            | `string`                   | `"on"`   | Native autocomplete                 |

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core): Core utilities, decorators, and base component class
- [@papit/field](https://github.com/onkelhoy/papit/tree/main/packages/system/field): Base class providing labels, error states, and form field layout

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
