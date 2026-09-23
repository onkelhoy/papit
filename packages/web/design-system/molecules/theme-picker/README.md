# @papit/theme-picker

Button and menu for switching a page between light, dark and system colour schemes. Sets data-theme on a target element and can remember the choice in local or session storage.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-molecules-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/theme-picker.svg?logo=npm)](https://www.npmjs.com/package/@papit/theme-picker)

---

# Installation

```bash
npm install @papit/theme-picker
```

---

# Usage

## Import

```javascript
import "@papit/theme-picker";
```

The icons load from `/icons/sun.svg`, `/icons/moon.svg` and `/icons/computer.svg`. Serve the package's `asset/icons/` folder at `/icons/`.

## Basic example

Switches the theme on `<html>`. Pair it with `@papit/theme`, which reads `data-theme`.

```html
<pap-theme-picker></pap-theme-picker>
```

## Remember the choice

```html
<pap-theme-picker storage="local"></pap-theme-picker>
```

## Theme one part of the page

```html
<section id="preview">…</section>
<pap-theme-picker target="#preview"></pap-theme-picker>
```

## React to changes

```javascript
const picker = document.querySelector("pap-theme-picker");
picker.addEventListener("change", () => console.log(picker.value));
```

---

# Attributes / Properties

| Attribute | Property  | Type                              | Default    | Description                                                            |
| --------- | --------- | --------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `value`   | `value`   | `"light" \| "dark" \| "system"`   | `"system"` | Current choice                                                         |
| `target`  | `target`  | `string`                          | `"html"`   | CSS selector of the element that gets the theme                        |
| `storage` | `storage` | `"local" \| "session"`            | —          | Save the choice under the `pap-theme` key and restore it on connect    |

What happens on the target:

- `light` / `dark`: sets `data-theme` and `style.colorScheme` to the value.
- `system`: removes `data-theme`, `colorScheme` and the `theme-light` / `theme-dark` classes.
- The target is watched: if something else sets `data-theme` or a `theme-light` / `theme-dark` class, `value` follows.
- The switch runs inside `document.startViewTransition` when available. Opening the menu sets `--theme-transition-location` on the target to the picker's position, which `@papit/theme` uses for its reveal animation.

Changing `storage` removes the value saved under the old storage.

---

# Events

| Event    | Description                                             |
| -------- | ------------------------------------------------------- |
| `change` | Fired whenever the theme is applied, including on setup |

---

# Styling

| Part      | Description            |
| --------- | ---------------------- |
| `trigger` | The icon button        |

---

# Keyboard Interaction

The trigger is a `pap-button` that opens a `pap-menu`, so keyboard handling is the menu button pattern from `@papit/menu`:

| Key                     | Behavior                                  |
| ----------------------- | ----------------------------------------- |
| `Enter` / `Space`       | On the button: open the menu. On an item: choose it |
| `ArrowDown` / `ArrowUp` | Move between Light, Dark and System       |
| `Escape`                | Close the menu                            |

---

# Accessibility

Built on `@papit/menu`, which follows the WAI-ARIA menu button pattern.

Known gaps:

- The icon button has no accessible name yet, and the built-in tooltip isn't wired to it.
- The current choice is marked with `aria-expanded` on its menu item rather than `menuitemradio` with `aria-checked`.
- The labels (Light, Dark, System) aren't translated yet.

Reference: [https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)

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
- [@papit/theme](https://github.com/onkelhoy/papit/tree/main/packages/web/themes/theme)
  The tokens that respond to `data-theme`.
- [@papit/menu](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/atoms/menu)
  The menu the picker opens.
