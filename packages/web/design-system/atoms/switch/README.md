# @papit/switch

A binary on/off toggle control implemented as a Web Component. Use a switch instead of a checkbox when the meaning is stateful rather than selection — for example _“Notifications on”_ reads more naturally than “Notifications checked”.

The component follows the **WAI-ARIA Switch Pattern**, supports **keyboard interaction**, and **participates in HTML forms** like a native input.

See the pattern: [https://www.w3.org/WAI/ARIA/apg/patterns/switch/](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/switch.svg?logo=npm)](https://www.npmjs.com/package/@papit/switch)

---

# Installation

```bash
npm install @papit/switch
```

---

# Usage

## Import

```javascript
import "@papit/switch";
```

## Basic example

```html
<pap-switch></pap-switch>
```

## With label

```html
<label>
  Notifications
  <pap-switch></pap-switch>
</label>
```

## Default checked

```html
<pap-switch defaultchecked></pap-switch>
```

---

# Form Support

`pap-switch` participates in forms using **ElementInternals**.

When the switch is **on**, it submits `"true"` as its form value.

```html
<form>
  <pap-switch name="notifications"></pap-switch>

  <button type="submit">Submit</button>
</form>
```

Example submitted data:

```json
{
  "notifications": "true"
}
```

If the switch is **off**, no value is submitted — the same behavior as a native checkbox.

---

# Attributes / Properties

| Attribute        | Property         | Type      | Description                           |
| ---------------- | ---------------- | --------- | ------------------------------------- |
| `checked`        | `checked`        | `boolean` | Current state of the switch           |
| `defaultchecked` | `defaultChecked` | `boolean` | Initial state used when a form resets |
| `disabled`       | `disabled`       | `boolean` | Prevents interaction                  |
| `readonly`       | —                | `boolean` | Prevents toggling but allows focus    |

---

# Events

| Event    | Description                             |
| -------- | --------------------------------------- |
| `change` | Fired whenever the switch state changes |

Example:

```javascript
const el = document.querySelector("pap-switch");

el.addEventListener("change", () => {
  console.log("Switch state:", el.checked);
});
```

---

# Keyboard Interaction

| Key     | Behavior          |
| ------- | ----------------- |
| `Space` | Toggle the switch |
| `Enter` | Toggle the switch |

During keyboard press the component temporarily exposes an internal **`active` state** for styling.

---

# Accessibility

This component implements the **ARIA Switch Pattern** and automatically manages:

- `role="switch"`
- `aria-checked`
- keyboard interaction
- focus behavior

Reference:

[https://www.w3.org/WAI/ARIA/apg/patterns/switch/](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)

---

# Styling

The component uses a **constructed stylesheet** and exposes internal states that can be styled:

```css
pap-switch:state(checked) {
  /* some style goes here */
}

pap-switch:state(active) {
  /* some style goes here */
}
```

Example:

```css
pap-switch:state(checked) {
  background: green;
}
```

---

# Contributing

Contributions are welcome.

Please ensure:

- tests pass
- linting passes
- behavior follows the ARIA switch pattern

Submit pull requests through the GitHub repository.

---

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

# Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core)
  Core utilities, decorators, and base component class.

---

# Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
