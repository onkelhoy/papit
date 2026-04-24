# @papit/splitter

A resizable split-pane component implemented as a Web Component. Use a splitter when you want to let users control the relative size of two panels by dragging a separator or using the keyboard.

The component follows the **WAI-ARIA Window Splitter Pattern**, supports **keyboard interaction**, and works in both **vertical** (side by side) and **horizontal** (stacked) orientations.

See the pattern: [https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/splitter.svg?logo=npm)](https://www.npmjs.com/package/@papit/splitter)

---

# Installation

```bash
npm install @papit/splitter
```

---

# Usage

## Import

```javascript
import "@papit/splitter";
```

## Basic example

```html
<pap-splitter label="Sidebar" style="height: 400px;">
  <nav slot="primary">Sidebar</nav>
  <main slot="secondary">Content</main>
</pap-splitter>
```

## Horizontal split

```html
<pap-splitter split="horizontal" label="Editor" style="height: 600px;">
  <div slot="primary">Editor</div>
  <div slot="secondary">Terminal</div>
</pap-splitter>
```

## With custom bounds

```html
<pap-splitter label="Sidebar" min="20" max="80" style="height: 400px;">
  <nav slot="primary">Sidebar</nav>
  <main slot="secondary">Content</main>
</pap-splitter>
```

---

# Slots

| Slot        | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| `primary`   | The primary pane. Its size is controlled by the splitter value. |
| `secondary` | The secondary pane. Takes up all remaining space.               |

---

# Attributes / Properties

| Attribute   | Property   | Type                         | Default      | Description                                      |
| ----------- | ---------- | ---------------------------- | ------------ | ------------------------------------------------ |
| `split`     | `split`    | `"vertical" \| "horizontal"` | `"vertical"` | Orientation of the splitter                      |
| `label`     | `label`    | `string`                     | `""`         | Accessible label for the separator handle        |
| `min`       | `min`      | `number`                     | `0`          | Minimum size of the primary pane as a percentage |
| `max`       | `max`      | `number`                     | `100`        | Maximum size of the primary pane as a percentage |
| `step`      | `step`     | `number`                     | `5`          | Keyboard step size in percent                    |
| `data-drag` | `dragging` | `boolean`                    | `false`      | Reflects whether the separator is being dragged  |

---

# Keyboard Interaction

The separator handle is the focusable widget. All keyboard interaction happens when it has focus.

| Key          | Behavior                                                      |
| ------------ | ------------------------------------------------------------- |
| `ArrowLeft`  | Decrease primary pane size by one step (vertical mode)        |
| `ArrowRight` | Increase primary pane size by one step (vertical mode)        |
| `ArrowUp`    | Decrease primary pane size by one step (horizontal mode)      |
| `ArrowDown`  | Increase primary pane size by one step (horizontal mode)      |
| `Home`       | Set primary pane to its minimum size                          |
| `End`        | Set primary pane to its maximum size                          |
| `Enter`      | Collapse the primary pane, or restore it to the previous size |
| `Escape`     | Cancel a drag and restore the previous size                   |

---

# Accessibility

This component implements the **ARIA Window Splitter Pattern** using `role="separator"` on the drag handle. It automatically manages:

- `role="separator"`
- `aria-orientation`
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- `aria-controls` pointing to the primary pane
- Full keyboard interaction

References:

- [WAI-ARIA Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
- [MDN: ARIA separator role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/separator_role)

---

# Styling

The component exposes a `--value` custom property that reflects the current primary pane size as a percentage. You can use CSS `::part()` to style the internal regions.

```css
pap-splitter::part(separator) {
  background: #ccc;
  width: 4px;
}

pap-splitter::part(thumb) {
  background: #888;
  border-radius: 2px;
}

pap-splitter[data-drag]::part(separator) {
  background: #0070f3;
}
```

Available parts:

| Part        | Description                          |
| ----------- | ------------------------------------ |
| `primary`   | The primary pane wrapper             |
| `secondary` | The secondary pane wrapper           |
| `separator` | The draggable divider element        |
| `thumb`     | The visual handle inside the divider |

---

# Contributing

Contributions are welcome.

Please ensure:

- tests pass
- linting passes
- behavior follows the ARIA Window Splitter pattern

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
