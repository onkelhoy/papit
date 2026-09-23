# @papit/icon

Renders SVG icons inline from a URL, a spritesheet symbol or a registered string, and country flags from a two-letter code. Fetched icons are shared between instances and can be cached in localStorage.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-foundations-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/icon.svg?logo=npm)](https://www.npmjs.com/package/@papit/icon)

---

# Installation

```bash
npm install @papit/icon
```

---

# Usage

## Import

```javascript
import "@papit/icon";
```

## By name

A bare name is fetched from the site root: `moon` loads `/moon.svg`.

```html
<pap-icon name="moon"></pap-icon>
```

## By URL

```html
<pap-icon name="https://example.com/icons/sun.svg"></pap-icon>
<pap-icon name="./icons/sun.svg"></pap-icon>
```

## From a spritesheet

The part after `#` picks the symbol. Every `<symbol>` in the sheet is registered under its `id`, so later icons from the same sheet need no fetch.

```html
<pap-icon name="/icons/sprite.svg#blend"></pap-icon>
<pap-icon name="blend"></pap-icon>
```

## Registered up front

```javascript
import { Icon } from "@papit/icon";

Icon.icons.set("check", `<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`);
```

```html
<pap-icon name="check"></pap-icon>
```

## Flag

```html
<pap-icon flag="se"></pap-icon>
```

## Cache in localStorage

```html
<pap-icon cache name="moon"></pap-icon>
```

---

# Attributes / Properties

| Attribute | Property  | Type      | Default        | Description                                                                 |
| --------- | --------- | --------- | -------------- | --------------------------------------------------------------------------- |
| `name`    | `name`    | `string`  | —              | Registered icon name, bare name (fetched as `/<name>.svg`), URL, or `url#symbol` |
| `flag`    | `flag`    | `string`  | —              | Country code (e.g. `se`, `gb`) rendered as a flag emoji. Takes priority over `name` |
| `cache`   | `cache`   | `boolean` | `false`        | Store fetched SVG text in localStorage and read it back before fetching     |
| `storage` | `storage` | `string`  | `"papit-icon"` | localStorage key prefix; the key is prefix + URL                            |

The response must have an SVG `Content-Type`; anything else is logged and ignored.

## Static

| Member        | Type                  | Description                                                              |
| ------------- | --------------------- | ------------------------------------------------------------------------ |
| `Icon.icons`  | `Map<string, string>` | Registry of SVG markup by name, shared by every `pap-icon`. Fetched icons land here too |

---

# Slots

| Slot      | Description                                        |
| --------- | -------------------------------------------------- |
| (default) | Fallback content, e.g. text or an emoji. It stays rendered next to the icon once one loads |

---

# Styling

| Part       | Description                        |
| ---------- | ---------------------------------- |
| `svg`      | A fetched SVG (not set on markup registered through `Icon.icons`) |
| `flag`     | The flag emoji wrapper             |
| `fallback` | The default slot                   |

The host is `24px` square (`--space-6`) and the SVG fills it with `currentColor` (`--text`). Size and colour it from outside:

```css
pap-icon {
  width: 32px;
  height: 32px;
  color: var(--primary);
}
```

---

# Accessibility

The icon sets no role. Hide decorative icons from assistive tech, and name meaningful ones:

```html
<pap-icon name="moon" aria-hidden="true"></pap-icon>
<pap-icon name="warning" role="img" aria-label="Warning"></pap-icon>
```

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
- [@papit/svg-spritesheet](https://github.com/onkelhoy/papit/tree/main/packages/runtime/svg-spritesheet)
  Builds the spritesheets `pap-icon` reads.
