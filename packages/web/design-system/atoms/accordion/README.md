# @papit/accordion

A wcag complient accordion component

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/accordion.svg?logo=npm)](https://www.npmjs.com/package/@papit/accordion)

---

Implements the [WAI-ARIA Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) using three composable custom elements. Keyboard navigation (Arrow keys, Home, End, Tab, Shift+Tab) is handled by `pap-group`. Each header exposes `aria-expanded` and `aria-controls` pointing to its associated panel container, and each panel container receives `role="region"` with `aria-labelledby` referencing the header button.

## Installation

```bash
npm install @papit/accordion
```

## Usage

```html
<script type="module" defer>
  import "@papit/accordion";
</script>

<!-- Single panel -->
<pap-accordion>
  <pap-accordion-header>Billing</pap-accordion-header>
  <pap-accordion-panel>Your billing info here.</pap-accordion-panel>
</pap-accordion>

<!-- Multiple panels, single mode (default) -->
<pap-accordion>
  <div role="region">
    <pap-accordion-header>Section 1</pap-accordion-header>
    <pap-accordion-panel>Content 1</pap-accordion-panel>
  </div>
  <div role="region">
    <pap-accordion-header>Section 2</pap-accordion-header>
    <pap-accordion-panel>Content 2</pap-accordion-panel>
  </div>
</pap-accordion>

<!-- Multiple panels open at once -->
<pap-accordion mode="multiple">
  <div role="region">
    <pap-accordion-header>Section 1</pap-accordion-header>
    <pap-accordion-panel>Content 1</pap-accordion-panel>
  </div>
  <div role="region">
    <pap-accordion-header>Section 2</pap-accordion-header>
    <pap-accordion-panel>Content 2</pap-accordion-panel>
  </div>
</pap-accordion>
```

## Components

### `pap-accordion`

The root container. Manages which panels are open via a shared `value` context (array of open header ids).

| Attribute | Type                     | Default    | Description                                           |
| --------- | ------------------------ | ---------- | ----------------------------------------------------- |
| `mode`    | `"single" \| "multiple"` | `"single"` | Whether one or many panels can be open simultaneously |

### `pap-accordion-header`

The interactive heading. Renders a button with `aria-expanded` and `aria-controls`. Place directly inside `pap-accordion` or inside a `div[role="region"]` wrapper.

| Attribute    | Type      | Default | Description                                     |
| ------------ | --------- | ------- | ----------------------------------------------- |
| `aria-level` | `number`  | `3`     | Heading level exposed to the accessibility tree |
| `open`       | `boolean` | `false` | Whether the associated panel is open            |

### `pap-accordion-panel`

The collapsible content panel. Receives `open` via context from the accordion and exposes it as an attribute for CSS targeting.

| Attribute | Type                | Default   | Description                                 |
| --------- | ------------------- | --------- | ------------------------------------------- |
| `open`    | `"true" \| "false"` | `"false"` | Reflects open state — use for CSS show/hide |

## Keyboard Interaction

| Key               | Behaviour                                |
| ----------------- | ---------------------------------------- |
| `Enter` / `Space` | Toggle the focused header's panel        |
| `ArrowDown`       | Move focus to the next header            |
| `ArrowUp`         | Move focus to the previous header        |
| `Tab`             | Move focus out of the accordion forward  |
| `Shift+Tab`       | Move focus out of the accordion backward |

## Accessibility

- `pap-accordion-header` sets `role="heading"` and `aria-level` on the host element
- The internal button carries `aria-expanded` and `aria-controls` pointing to the panel container id
- When a `div[role="region"]` wrapper is used, it receives `aria-labelledby` referencing the header button
- Avoid `role="region"` wrappers when more than ~6 panels may be expanded simultaneously, to prevent landmark proliferation

See the [WAI-ARIA Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) for full specification details.

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core): Core utilities, decorators, and base component class
- [@papit/group](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/group): Roving tabindex keyboard navigation
- [@papit/button](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/button): Roving tabindex keyboard navigation
- [@papit/icon](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/icon): Roving tabindex keyboard navigation

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
