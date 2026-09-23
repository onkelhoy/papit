# @papit/group

Non-visual container that moves keyboard focus between its children with a roving tabindex. Wrap toolbars, button rows and lists in it to get arrow key, Home and End navigation.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-foundations-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/group.svg?logo=npm)](https://www.npmjs.com/package/@papit/group)

---

# Installation

```bash
npm install @papit/group
```

---

# Usage

## Import

```javascript
import "@papit/group";
```

## Basic example

A horizontal toolbar. Tab enters the group once, the arrow keys move between the buttons.

```html
<pap-group aria-label="Text formatting">
  <button>Bold</button>
  <button>Italic</button>
  <button>Underline</button>
</pap-group>
```

## Vertical

```html
<pap-group aria-orientation="vertical">
  <button>Cut</button>
  <button>Copy</button>
  <button>Paste</button>
</pap-group>
```

## Wrapped children

A slotted child that isn't focusable itself is searched for focusable descendants, so wrappers and lists work too.

```html
<pap-group aria-orientation="vertical">
  <ul>
    <li tabindex="0">One</li>
    <li tabindex="0">Two</li>
    <li tabindex="0">Three</li>
  </ul>
</pap-group>
```

## No wrapping, all four arrows

```html
<pap-group loop="false" up down left right>
  <button>1</button>
  <button>2</button>
  <button>3</button>
</pap-group>
```

---

# Attributes / Properties

| Attribute          | Property      | Type                         | Default        | Description                                                  |
| ------------------ | ------------- | ---------------------------- | -------------- | ------------------------------------------------------------ |
| `aria-orientation` | `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Picks the arrow keys: Left/Right when horizontal, Up/Down when vertical |
| `loop`             | `loop`        | `boolean`                    | `true`         | Wrap from the last element to the first and back             |
| `home`             | `home`        | `boolean`                    | `true`         | Enable the Home key                                          |
| `end`              | `end`         | `boolean`                    | `true`         | Enable the End key                                           |
| `up`               | `up`          | `boolean`                    | from orientation | Enable ArrowUp                                             |
| `down`             | `down`        | `boolean`                    | from orientation | Enable ArrowDown                                           |
| `left`             | `left`        | `boolean`                    | from orientation | Enable ArrowLeft                                           |
| `right`            | `right`       | `boolean`                    | from orientation | Enable ArrowRight                                          |

Boolean attributes set to `"false"` turn the option off. On connect, an explicit `up`/`down`/`left`/`right` attribute wins over the orientation default; changing `aria-orientation` later resets all four.

---

# Slots

| Slot      | Description                                                                    |
| --------- | ------------------------------------------------------------------------------ |
| (default) | The elements to navigate. Non-focusable children contribute their focusable descendants. |

---

# Methods

| Method    | Description                                   |
| --------- | --------------------------------------------- |
| `first()` | Focus the first enabled element               |
| `last()`  | Focus the last enabled element                |
| `next()`  | Focus the next enabled element (honours `loop`) |
| `prev()`  | Focus the previous enabled element (honours `loop`) |

`first()`, `last()`, `next()` and `prev()` throw when every element is disabled or hidden.

---

# Keyboard Interaction

| Key          | Behavior                                               |
| ------------ | ------------------------------------------------------ |
| `Tab`        | Enters the group on the last active element, then leaves it |
| `ArrowRight` | Next element (horizontal, or when `right` is set)      |
| `ArrowLeft`  | Previous element (horizontal, or when `left` is set)   |
| `ArrowDown`  | Next element (vertical, or when `down` is set)         |
| `ArrowUp`    | Previous element (vertical, or when `up` is set)       |
| `Home`       | First element                                          |
| `End`        | Last element                                           |

Disabled and hidden elements are skipped.

---

# Accessibility

- Sets `role="toolbar"` unless you give it a `role` of your own.
- Only one element is in the tab order at a time (roving tabindex); the group remembers the last active element.
- Give the group an accessible name with `aria-label` or `aria-labelledby`.

Reference: [https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)

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
