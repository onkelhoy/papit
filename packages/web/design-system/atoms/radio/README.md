# @papit/radio

A WAI-ARIA compliant radio button web component, built on @papit/web-component.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/radio.svg?logo=npm)](https://www.npmjs.com/package/@papit/radio)

---

## Installation

```bash
npm install @papit/radio
```

### HTML (ESM)

```html
<script type="module" defer>
  import "@papit/radio";
</script>

<pap-radio name="plan" value="free">Free</pap-radio>
<pap-radio name="plan" value="pro" defaultchecked>Pro</pap-radio>
```

### JavaScript / TypeScript

```ts
import "@papit/radio";
// or, to use the class directly:
import { Radio } from "@papit/radio";
```

---

## Usage

### Standalone

```html
<pap-radio name="plan" value="free">Free</pap-radio>
<pap-radio name="plan" value="pro">Pro</pap-radio>
<pap-radio name="plan" value="enterprise">Enterprise</pap-radio>
```

Radios sharing the same `name` form a group — only one can be checked at a
time. Arrow-key navigation moves between them automatically.

### With `pap-group`

Wrap in `pap-group` to control layout and orientation semantics:

```html
<pap-group aria-label="Subscription plan" aria-orientation="vertical">
  <pap-radio name="plan" value="free">Free</pap-radio>
  <pap-radio name="plan" value="pro" defaultchecked>Pro</pap-radio>
  <pap-radio name="plan" value="enterprise">Enterprise</pap-radio>
</pap-group>
```

### Inside a form

```html
<form>
  <pap-group aria-label="Notify me">
    <pap-radio name="notify" value="always" defaultchecked>Always</pap-radio>
    <pap-radio name="notify" value="never">Never</pap-radio>
  </pap-group>
  <button type="submit">Save</button>
  <button type="reset">Reset</button>
</form>
```

`pap-radio` is form-associated. The `value` attribute is submitted with the
form when the radio is checked; on reset, each radio returns to its
`defaultchecked` state (or unchecked if `defaultchecked` is absent).

### Disabled & readonly

```html
<!-- Cannot be interacted with at all -->
<pap-radio name="x" value="a" disabled>Disabled</pap-radio>

<!-- Focusable, readable by screen readers, but state cannot change -->
<pap-radio name="x" value="b" readonly>Read-only</pap-radio>
```

---

## Attributes

| Attribute        | Type      | Default | Description                                                   |
| ---------------- | --------- | ------- | ------------------------------------------------------------- |
| `name`           | `string`  | —       | Groups radios; enables mutual exclusion and arrow-key nav     |
| `value`          | `string`  | —       | Form value submitted when this radio is checked               |
| `checked`        | `boolean` | `false` | Whether this radio is currently selected                      |
| `defaultchecked` | `boolean` | —       | Checked state restored on form reset; also sets initial state |
| `disabled`       | `boolean` | —       | Disables all interaction                                      |
| `readonly`       | `boolean` | —       | Prevents state changes; focus is still possible               |

---

## CSS Custom Properties

| Property        | Default        | Description                                  |
| --------------- | -------------- | -------------------------------------------- |
| `--space-1`     | `0.25rem`      | Gap between marker and label; outline offset |
| `--space-5`     | `1.25rem`      | Marker width and height                      |
| `--info`        | —              | Inner dot fill colour when checked           |
| `--accentColor` | `currentColor` | Accent colour (used via `--accent`)          |

### Parts

| Part     | Description            |
| -------- | ---------------------- |
| `marker` | The circular indicator |

```css
/* Example: custom checked colour */
pap-radio::part(marker) {
  border-color: royalblue;
}

pap-radio {
  --info: royalblue;
}
```

---

## Events

| Event    | Bubbles | Description                  |
| -------- | ------- | ---------------------------- |
| `change` | No      | Fired when `checked` changes |

---

## Keyboard Interaction

Follows the [WAI-ARIA Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).

| Key                        | Behaviour                                                              |
| -------------------------- | ---------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`        | Moves focus into / out of the group (one tab stop via roving tabindex) |
| `Space`                    | Checks the focused radio if unchecked                                  |
| `Enter`                    | Same as `Space`                                                        |
| `ArrowRight` / `ArrowDown` | Moves focus to the next radio, checks it, wraps around                 |
| `ArrowLeft` / `ArrowUp`    | Moves focus to the previous radio, checks it, wraps around             |

> A radio button **cannot** be unchecked by user interaction. Only selecting a
> different button in the group will uncheck the current one.

---

## ARIA

| Attribute / Role | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| `role`           | `radio`                                                                             |
| `aria-checked`   | `"true"` / `"false"` (reflects `checked`)                                           |
| `tabindex`       | Managed via roving tabindex — `"0"` for the active/first radio, `"-1"` for the rest |

The group label should be provided by the parent container (e.g. `pap-group`
with `aria-label` or `aria-labelledby`).

---

## Contributing

Contributions are welcome! Please follow the development guidelines and ensure
all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 — Copyright © 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core) — Core utilities, decorators, and base class
- [@papit/group](https://github.com/onkelhoy/papit/tree/main/packages/atoms/group) — Layout and orientation wrapper for radio groups

## Support

For issues, questions, or contributions, please visit the
[GitHub repository](https://github.com/onkelhoy/papit).
