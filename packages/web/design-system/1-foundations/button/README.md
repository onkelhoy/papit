# @papit/button

A form-associated button web component with minimal default styling. It submits or resets its form like a native button.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-foundations-orange)
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
<pap-button color="tertiary">Tertiary</pap-button>
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
| `color`    | `primary \| secondary \| tertiary \| success \| warning \| error \| information` | `primary` | Button color (`tiertery` still works, deprecated)      |
| `variant`  | `filled \| outline \| clear`                                                     | `filled`  | Button style variant                                   |
| `size`     | `small \| medium \| large \| icon`                                               | `medium`  | Button size                                            |
| `type`     | `submit \| reset`                                                                | —         | Form button type                                       |
| `href`     | `string`                                                                         | —         | Navigates to URL on click                              |
| `disabled` | `boolean`                                                                        | —         | Disables all interaction                               |
| `readonly` | `boolean`                                                                        | —         | Disables all interaction without visual disabled state |

### Variants and text color

- `filled` — accent background; text picks the contrasting color with `contrast-color()`, falling back to `--button-text` in browsers without it.
- `outline` / `clear` — transparent background; the accent is the text color, and hover/active tint the background.

### CSS Custom Properties

| Property               | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `--button-primary`     | Primary accent override                                |
| `--button-secondary`   | Secondary accent override                              |
| `--button-tertiary`    | Tertiary accent override                               |
| `--button-success`     | Success accent override                                |
| `--button-warning`     | Warning accent override                                |
| `--button-error`       | Error accent override                                  |
| `--button-information` | Information accent override                            |
| `--button-text`        | Filled text fallback (default `--text-inverse`)        |

### Keyboard interaction

| Key               | Behavior                                                       |
| ----------------- | -------------------------------------------------------------- |
| `Space`           | Activates on key up (key down only sets the active state and prevents page scroll) |
| `Enter`           | Activates the button                                           |

`disabled` and `readonly` buttons ignore both keys. Follows the [WAI-ARIA button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/).

---

## Related

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component) — core utilities, decorators, and base component class

---

## License

Licensed under the @Papit License 1.0 — Copyright (c) 2024 Henry Pap ([@onkelhoy](https://github.com/onkelhoy))

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.
