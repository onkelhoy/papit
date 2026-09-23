# @papit/tooltip

Hint bubble that appears next to a trigger on hover or focus, after a configurable delay. Connect it to any element with the popovertarget attribute.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/tooltip.svg?logo=npm)](https://www.npmjs.com/package/@papit/tooltip)

---

# Installation

```bash
npm install @papit/tooltip
```

---

# Usage

## Import

```javascript
import "@papit/tooltip";
```

## Basic example

The tooltip needs an `id`, and the trigger points at it with `popovertarget`. Both must be in the DOM when the tooltip connects.

```html
<button popovertarget="save-tip">Save</button>
<pap-tooltip id="save-tip">Save your changes (Ctrl+S)</pap-tooltip>
```

## Placement and marker

```html
<button popovertarget="info-tip">Info</button>
<pap-tooltip id="info-tip" placement="right" marker>
  Tooltips can hold <strong>simple HTML</strong>
</pap-tooltip>
```

## No delay

```html
<pap-tooltip id="quick-tip" instant>Shown right away</pap-tooltip>
<pap-tooltip id="slow-tip" delay="300">Shown after 300 ms</pap-tooltip>
```

Opening a tooltip closes any other open `pap-tooltip`.

---

# Attributes / Properties

Extends `pap-popover` (`@papit/popover`), so `open`, `show()`, `hide()` and `toggle()` work too.

| Attribute   | Property    | Type        | Default    | Description                                            |
| ----------- | ----------- | ----------- | ---------- | ------------------------------------------------------ |
| `placement` | `placement` | `Placement` | `"bottom"` | Side of the trigger (see `@papit/placement` for values) |
| `delay`     | `delay`     | `number`    | `1000`     | Milliseconds before the tooltip shows                  |
| `instant`   | `instant`   | `boolean`   | `false`    | Skip the delay                                         |
| `marker`    | `marker`    | `boolean`   | `false`    | Show an arrow pointing at the trigger                  |
| `disabled`  | `disabled`  | `boolean`   | `false`    | Never show; setting it hides an open tooltip           |
| `open`      | `open`      | `boolean`   | `false`    | Whether the tooltip is shown                           |

---

# Events

| Event    | Description                                         |
| -------- | --------------------------------------------------- |
| `toggle` | Native popover `ToggleEvent` when it shows or hides |

---

# Slots

| Slot      | Description         |
| --------- | ------------------- |
| (default) | The tooltip content |

---

# Methods

| Method          | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| `show(trigger?)` | Show after `delay` (or at once with `instant`), anchored to `trigger` |
| `hide()`        | Hide, and cancel a pending show                                    |

---

# Styling

| Part        | Description                     |
| ----------- | ------------------------------- |
| `container` | The bubble around the content   |

| Custom property       | Default | Description               |
| --------------------- | ------- | ------------------------- |
| `--max-tooltip-width` | `30rem` | Maximum width of the bubble |
| `--bg`                | mix of `--background-inverse` and `--shade-1` | Bubble and marker colour |

```css
pap-tooltip {
  --bg: var(--primary);
  --max-tooltip-width: 16rem;
}
```

---

# Keyboard Interaction

| Key   | Behavior                                                  |
| ----- | --------------------------------------------------------- |
| `Tab` | Focusing the trigger shows the tooltip; leaving it hides it |

---

# Accessibility

- Shows on hover and on keyboard focus of the trigger.
- The pointer can move onto the tooltip without it closing, so the content stays hoverable.

Known gaps against the pattern:

- `role="tooltip"` and `aria-describedby` on the trigger aren't set for you. Add them yourself:

  ```html
  <button popovertarget="save-tip" aria-describedby="save-tip">Save</button>
  <pap-tooltip id="save-tip" role="tooltip">Save your changes</pap-tooltip>
  ```

- `Escape` doesn't dismiss the tooltip yet.

Reference: [https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)

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

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component)
  Core utilities, decorators, and base component class.
- [@papit/popover](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/popover)
  The overlay `pap-tooltip` extends.
- [@papit/placement](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/placement)
  The `placement` values.
