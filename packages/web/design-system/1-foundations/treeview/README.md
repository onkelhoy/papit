# @papit/treeview

Accessible tree view for nested lists such as file explorers and navigation, following the WAI-ARIA tree pattern. Supports expand and collapse, single or multiple selection, full keyboard navigation and typeahead.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-foundations-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/treeview.svg?logo=npm)](https://www.npmjs.com/package/@papit/treeview)

---

# Installation

```bash
npm install @papit/treeview
```

---

# Usage

## Import

```javascript
import "@papit/treeview";
```

This registers both `pap-treeview` and `pap-treeitem`.

## With pap-treeitem

Nest `pap-treeitem` elements to make branches. A branch gets a caret icon and indents its children.

```html
<pap-treeview aria-label="File explorer">
  <pap-treeitem>README.md</pap-treeitem>
  <pap-treeitem>
    src
    <pap-treeitem>index.ts</pap-treeitem>
    <pap-treeitem>style.css</pap-treeitem>
  </pap-treeitem>
</pap-treeview>
```

The caret is `pap-icon name="caret-down"`, which loads `/caret-down.svg`. Serve `asset/icons/caret-down.svg` from your site root, or register the icon yourself (see `@papit/icon`).

## With plain HTML

Any element works as an item. Nest a `role="group"` inside it for a branch, and set `aria-expanded="true"` to start open.

```html
<pap-treeview aria-label="File explorer">
  <li role="treeitem">README.md</li>
  <li role="treeitem" aria-expanded="true">
    <span>src</span>
    <ul role="group">
      <li role="treeitem">index.ts</li>
      <li role="treeitem">style.css</li>
    </ul>
  </li>
</pap-treeview>
```

## Multiple selection

```html
<pap-treeview mode="multiple" aria-label="Files to upload">…</pap-treeview>
```

---

# Attributes / Properties

## pap-treeview

| Attribute          | Property      | Type                         | Default      | Description                                                         |
| ------------------ | ------------- | ---------------------------- | ------------ | ------------------------------------------------------------------- |
| `mode`             | `mode`        | `"single" \| "multiple"`     | `"single"`   | Selection mode. `multiple` sets `aria-multiselectable="true"`       |
| `strict`           | `strict`      | `boolean`                    | `false`      | Only register elements that already have `role="treeitem"`; otherwise every child of a group becomes an item |
| `aria-orientation` | `orientation` | `"horizontal" \| "vertical"` | `"vertical"` | Reflected for assistive tech; the keys stay the same                |

Selection lives in the DOM: a selected item has `aria-selected="true"`, an unselected one has no `aria-selected`. Expansion is `aria-expanded` on the item.

## pap-treeitem

No attributes of its own. The tree sets `role`, `tabindex`, `aria-expanded` and `aria-selected` on it.

---

# Events

All are plain `Event`s.

| Event      | Target       | Description                                     |
| ---------- | ------------ | ----------------------------------------------- |
| `active`   | the tree     | Focus moved into the tree                       |
| `inactive` | the tree     | Focus left the tree                             |
| `enter`    | the item     | Enter was pressed on the item                   |

```javascript
document.querySelector("pap-treeitem").addEventListener("enter", e => {
  console.log("open", e.target.textContent.trim());
});
```

---

# Slots

| Element        | Slot      | Description                                                    |
| -------------- | --------- | -------------------------------------------------------------- |
| `pap-treeview` | (default) | Top-level items                                                |
| `pap-treeitem` | (default) | The label. Nested `pap-treeitem`s are moved to `group` for you |
| `pap-treeitem` | `group`   | Child items                                                    |

---

# Styling

| Element        | Part      | Description                                  |
| -------------- | --------- | -------------------------------------------- |
| `pap-treeitem` | `content` | The row: caret and label                     |
| `pap-treeitem` | `group`   | The `role="group"` wrapper of child items    |

| Custom property | Default     | Description                                          |
| --------------- | ----------- | ---------------------------------------------------- |
| `--depth`       | `0rem`      | Left padding of the row; grows by `--space-4` per level |

The focused `pap-treeitem` row gets a `2px` `--focus-color` outline.

---

# Keyboard Interaction

| Key                | Behavior                                                             |
| ------------------ | -------------------------------------------------------------------- |
| `Tab`              | Enters the tree on the last focused item, then leaves it             |
| `ArrowDown`        | Next visible item                                                    |
| `ArrowUp`          | Previous visible item                                                |
| `ArrowRight`       | Closed branch: expand. Open branch: first child. Leaf: nothing       |
| `ArrowLeft`        | Open branch: collapse. Otherwise: parent item                        |
| `Home`             | First visible item                                                   |
| `End`              | Last visible item                                                    |
| `Enter`            | Branch: toggle expand. Leaf: select. Fires `enter` on the item       |
| `Space`            | Select (single) or toggle selection (multiple)                       |
| Printable character | Typeahead: next visible item whose label starts with the typed text |

Mouse: clicking a branch toggles it, clicking a leaf selects it.

---

# Accessibility

This component implements the **ARIA Tree View Pattern** and manages:

- `role="tree"` on the host, `role="treeitem"` on every item
- `aria-expanded` on branches (defaults to `"false"`)
- `aria-selected` and `aria-multiselectable`
- roving tabindex, so the tree is a single tab stop

Give the tree an accessible name with `aria-label` or `aria-labelledby`.

Reference: [https://www.w3.org/WAI/ARIA/apg/patterns/treeview/](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)

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
- [@papit/icon](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/icon)
  Renders the branch caret.
