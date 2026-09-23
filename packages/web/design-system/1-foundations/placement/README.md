# @papit/placement

Positions its content on a chosen side of an anchor element with CSS anchor positioning, with an optional arrow marker. Use it as the floating layer of tooltips, menus and popovers.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-foundations-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/placement.svg?logo=npm)](https://www.npmjs.com/package/@papit/placement)

---

# Installation

```bash
npm install @papit/placement
```

Needs a browser with CSS anchor positioning (`anchor-name`, `position-area`).

---

# Usage

## Import

```javascript
import "@papit/placement";
```

## Basic example

Name the anchor, then point the placement at it. By default it looks for `--anchor` below the anchor.

```html
<button style="anchor-name: --anchor">Anchor</button>

<pap-placement>Shown below the button</pap-placement>
```

## Pick a side

```html
<button style="anchor-name: --save">Save</button>

<pap-placement placement="right-top" style="--anchor-name: --save">
  Saved 2 minutes ago
</pap-placement>
```

Setting `position-anchor` directly works too:

```html
<pap-placement placement="top" style="position-anchor: --save">…</pap-placement>
```

## With an arrow marker

The marker is a `::after` arrow on the host, hidden by default. It inherits the host background.

```css
pap-placement::after {
  display: block;
}
```

---

# Attributes / Properties

| Attribute   | Property    | Type        | Default    | Description                                  |
| ----------- | ----------- | ----------- | ---------- | -------------------------------------------- |
| `placement` | `placement` | `Placement` | `"bottom"` | Side of the anchor and alignment along it    |

`Placement` is one of `top`, `top-left`, `top-center`, `top-right`, `bottom`, `bottom-left`, `bottom-center`, `bottom-right`, `left`, `left-top`, `left-center`, `left-bottom`, `right`, `right-top`, `right-center`, `right-bottom`. A bare side (`top`) is the same as its `-center` variant. The second word names the anchor edge the box lines up with: `bottom-left` starts at the anchor's left edge and grows right.

---

# Slots

| Slot      | Description                                         |
| --------- | --------------------------------------------------- |
| (default) | The floating content                                |
| `marker`  | Custom marker content, wrapped in the `marker` part |

---

# Styling

| Custom property  | Default                     | Description                                   |
| ---------------- | --------------------------- | --------------------------------------------- |
| `--anchor-name`  | `--anchor`                  | Anchor name used for `position-anchor`        |
| `--gap`          | `var(--space-2, 8px)`       | Distance between the anchor and the box       |
| `--marker-space` | `calc(-1 * var(--space-2) + 1px)` | Offset of the `::after` marker from the edge |

| Part     | Description                         |
| -------- | ----------------------------------- |
| `marker` | Wrapper around the `marker` slot    |

The host is `position: absolute` and `width: max-content`.

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
- [@papit/menu](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/atoms/menu)
  Uses `pap-placement` for submenus.
