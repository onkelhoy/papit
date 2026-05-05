# @papit/tabs

Accessible, WAI-ARIA compliant tabs component built with @papit/web-component.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/tabs.svg?logo=npm)](https://www.npmjs.com/package/@papit/tabs)

---

## Overview

`@papit/tabs` provides three custom elements — `<pap-tabs>`, `<pap-tab>`, and
`<pap-tabpanel>` — that together form a fully accessible tabbed interface following
the [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

Tab and panel pairing is handled automatically through a shared `value` attribute.
The active selection propagates to all children via context, keeping the API
declarative and requiring no manual wiring.

---

## Installation

```bash
npm install @papit/tabs
```

### HTML (module script)

```html
<script type="module" defer>
  import "@papit/tabs";
</script>

<pap-tabs>
  <pap-tab value="first">First</pap-tab>
  <pap-tab value="second">Second</pap-tab>

  <pap-tabpanel value="first">Content for the first panel.</pap-tabpanel>
  <pap-tabpanel value="second">Content for the second panel.</pap-tabpanel>
</pap-tabs>
```

### JavaScript / TypeScript

```typescript
import "@papit/tabs";
import { Tabs, Tab, TabPanel } from "@papit/tabs";
```

---

## Elements

### `<pap-tabs>`

The root container. Manages a `<pap-group role="tablist">` internally and
distributes children into the correct slots.

| Attribute          | Type                         | Default        | Description                              |
| ------------------ | ---------------------------- | -------------- | ---------------------------------------- |
| `aria-orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Orientation passed to the inner tablist. |
| `value`            | `string`                     | first tab      | Value of the currently active tab.       |

**CSS Part**

| Part      | Description                                         |
| --------- | --------------------------------------------------- |
| `tablist` | The `<pap-group>` element wrapping the tab buttons. |

---

### `<pap-tab>`

A tab button element. Place inside `<pap-tabs>` alongside `<pap-tabpanel>` elements.

| Attribute | Type     | Description                                                 |
| --------- | -------- | ----------------------------------------------------------- |
| `value`   | `string` | Links this tab to the `<pap-tabpanel>` with the same value. |

**ARIA attributes set automatically:**

- `role="tab"`
- `aria-selected` — `"true"` when active, `"false"` otherwise
- `aria-controls` — set to the `id` of the matching `<pap-tabpanel>`

**CSS custom state:**

- `:state(selected)` — applied when this tab is active

---

### `<pap-tabpanel>`

A content panel. Visibility is CSS-driven using the `:state(selected)` custom state.

| Attribute | Type     | Description                                              |
| --------- | -------- | -------------------------------------------------------- |
| `value`   | `string` | Links this panel to the `<pap-tab>` with the same value. |

**ARIA attributes set automatically:**

- `role="tabpanel"`
- `aria-labelledby` — set to the `id` of the matching `<pap-tab>`

**CSS custom state:**

- `:state(selected)` — applied when this panel is active

---

## Accessibility

This component follows the [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

### ARIA roles, states, and properties

| Element          | Role       | Key ARIA attributes                                |
| ---------------- | ---------- | -------------------------------------------------- |
| `<pap-tabs>`     | —          | Contains the `tablist`; exposes `aria-orientation` |
| Inner group      | `tablist`  | `aria-orientation`                                 |
| `<pap-tab>`      | `tab`      | `aria-selected`, `aria-controls`                   |
| `<pap-tabpanel>` | `tabpanel` | `aria-labelledby`                                  |

### Keyboard interaction

| Key                                   | Behaviour                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `Tab`                                 | Moves focus into the tablist (onto the active tab), then out to the active panel. |
| `ArrowRight` / `ArrowDown` (vertical) | Moves focus to the next tab; activates it automatically.                          |
| `ArrowLeft` / `ArrowUp` (vertical)    | Moves focus to the previous tab; activates it automatically.                      |
| `Home` _(delegated to `<pap-group>`)_ | Moves focus to the first tab.                                                     |
| `End` _(delegated to `<pap-group>`)_  | Moves focus to the last tab.                                                      |
| `Space` / `Enter`                     | Activates the focused tab if not already active.                                  |

> Tabs use **automatic activation** — focus alone selects the tab, which is the
> recommended behaviour when panel content is preloaded without noticeable latency
> ([APG note](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/#keyboard-interaction)).

---

## Styling

### Show/hide panels

Panel visibility is entirely CSS-driven. The recommended approach:

```css
pap-tabpanel {
  display: none;
}

pap-tabpanel:state(selected) {
  display: block;
}
```

### Style the active tab

```css
pap-tab:state(selected) {
  border-bottom: 2px solid currentColor;
  font-weight: bold;
}
```

### Target the tablist

```css
pap-tabs::part(tablist) {
  border-bottom: 1px solid #ccc;
  display: flex;
  gap: 0.5rem;
}
```

---

## Examples

### Vertical tabs

```html
<pap-tabs aria-orientation="vertical">
  <pap-tab value="profile">Profile</pap-tab>
  <pap-tab value="billing">Billing</pap-tab>

  <pap-tabpanel value="profile">Profile settings…</pap-tabpanel>
  <pap-tabpanel value="billing">Billing settings…</pap-tabpanel>
</pap-tabs>
```

### Programmatic selection

```javascript
const tabs = document.querySelector("pap-tabs");
tabs.value = "billing";
```

---

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 — Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Related components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core) — Core utilities, decorators, and base component class
- [@papit/group](https://github.com/onkelhoy/papit/tree/main/packages/atoms/group) — Roving tabindex group used as the internal tablist

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
