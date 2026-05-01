# @papit/button

Basic button with minimal style.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-1--foundations-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/button.svg?logo=npm)](https://www.npmjs.com/package/@papit/button)

---

## Installation

```bash
npm install @papit/button
```

### HTML

```html
<script type="module" defer>
  import "@papit/button";
</script>

<pap-button>Click me</pap-button>
```

### ESM

```js
import "@papit/button";
```

---

## Usage

```html
<!-- Colors -->
<pap-button color="primary">Primary</pap-button>
<pap-button color="secondary">Secondary</pap-button>
<pap-button color="success">Success</pap-button>
<pap-button color="error">Error</pap-button>
<pap-button color="warning">Warning</pap-button>
<pap-button color="information">Information</pap-button>

<!-- Variants -->
<pap-button variant="filled">Filled</pap-button>
<pap-button variant="outline">Outline</pap-button>
<pap-button variant="clear">Clear</pap-button>

<!-- Sizes -->
<pap-button size="small">Small</pap-button>
<pap-button size="medium">Medium</pap-button>
<pap-button size="large">Large</pap-button>
<pap-button size="icon">⚙</pap-button>

<!-- Form -->
<form>
  <input name="email" />
  <pap-button type="submit">Submit</pap-button>
  <pap-button type="reset">Reset</pap-button>
</form>

<!-- Link -->
<pap-button href="https://example.com">Go</pap-button>

<!-- States -->
<pap-button disabled>Disabled</pap-button>
<pap-button readonly>Readonly</pap-button>
```

---

## API

### Attributes / Properties

| Attribute  | Type                                                                             | Default   | Description                                            |
| ---------- | -------------------------------------------------------------------------------- | --------- | ------------------------------------------------------ |
| `color`    | `primary \| secondary \| tiertery \| success \| warning \| error \| information` | `primary` | Button color                                           |
| `variant`  | `filled \| outline \| clear`                                                     | `filled`  | Button style variant                                   |
| `size`     | `small \| medium \| large \| icon`                                               | `medium`  | Button size                                            |
| `type`     | `submit \| reset`                                                                | —         | Form button type                                       |
| `href`     | `string`                                                                         | —         | Navigates to URL on click                              |
| `disabled` | `boolean`                                                                        | —         | Disables all interaction                               |
| `readonly` | `boolean`                                                                        | —         | Disables all interaction without visual disabled state |

### CSS Custom Properties

| Property                     | Description                     |
| ---------------------------- | ------------------------------- |
| `--button-primary`           | Primary color override          |
| `--button-primary-color`     | Primary text color override     |
| `--button-secondary`         | Secondary color override        |
| `--button-secondary-color`   | Secondary text color override   |
| `--button-tiertery`          | Tiertery color override         |
| `--button-tiertery-color`    | Tiertery text color override    |
| `--button-success`           | Success color override          |
| `--button-success-color`     | Success text color override     |
| `--button-warning`           | Warning color override          |
| `--button-warning-color`     | Warning text color override     |
| `--button-error`             | Error color override            |
| `--button-error-color`       | Error text color override       |
| `--button-information`       | Information color override      |
| `--button-information-color` | Information text color override |

---

## Related

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core) — core utilities, decorators, and base component class

---

## Contributing

Contributions are welcome! Please ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 — Copyright (c) 2024 Henry Pap ([@onkelhoy](https://github.com/onkelhoy))

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
