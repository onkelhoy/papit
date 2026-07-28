# @papit/table-of-content

A page-aware table of contents component. It queries headings (or any `role="heading"` element) from the surrounding document, assigns stable `id` attributes derived from their text content, and renders a hierarchical `pap-treeview` that highlights whichever headings are currently visible in the viewport. Clicking an item navigates to the corresponding section via the URL hash.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/table-of-content.svg?logo=npm)](https://www.npmjs.com/package/@papit/table-of-content)

---

## Installation

```bash
npm install @papit/table-of-content
```

### HTML

```html
<script type="module" defer>
  import "@papit/table-of-content";
</script>

<pap-table-of-content></pap-table-of-content>
```

### JavaScript / TypeScript

```ts
import "@papit/table-of-content";
```

---

## Usage

Place `<pap-table-of-content>` anywhere on the page. By default it scans the **root node** (document or shadow root) for all heading elements and `role="heading"` elements, excluding those with `aria-hidden` or `data-skipped`.

```html
<pap-table-of-content></pap-table-of-content>

<main>
  <h1>Introduction</h1>
  <h2>Getting started</h2>
  <h3>Prerequisites</h3>
  <h2>API reference</h2>
</main>
```

As the user scrolls, the items corresponding to visible headings receive the `marked` class and the host gains the `:state(scrolling)` custom state.

### Custom query

Override which elements are observed by setting the `query` attribute or property:

```html
<!-- Only observe h2 and h3 -->
<pap-table-of-content query="h2, h3"></pap-table-of-content>
```

### Icons

Add a `data-icon` attribute to a heading to render a `pap-icon` beside its label in the tree:

```html
<h2 data-icon="star">Highlights</h2>
```

### Reading the active set

```ts
const toc = document.querySelector("pap-table-of-content");
toc.addEventListener("change", () => {
  console.log(toc.value); // [{ href: '#...', name: '...' }, ...]
});
```

---

## Properties

| Property | Attribute | Type                               | Default               | Description                                                           |
| -------- | --------- | ---------------------------------- | --------------------- | --------------------------------------------------------------------- |
| `query`  | `query`   | `string`                           | All heading selectors | CSS selector used to discover headings. Reflected from the attribute. |
| `links`  | —         | `Link[]`                           | `[]`                  | Internal list of discovered links; not reflected.                     |
| `value`  | —         | `{ href: string; name: string }[]` | —                     | Read-only. Returns the subset of links currently marked as visible.   |

---

## Events

| Event    | Detail | Description                                                                              |
| -------- | ------ | ---------------------------------------------------------------------------------------- |
| `change` | —      | Fired whenever the set of visible headings changes (throttled via IntersectionObserver). |

---

## CSS Parts

| Part     | Element              | Description                       |
| -------- | -------------------- | --------------------------------- |
| `tree`   | `pap-treeview`       | The root tree element.            |
| `item`   | `pap-treeitem`       | Each individual tree item.        |
| `anchor` | `<a>` inside an item | The anchor link inside each item. |

---

## Custom States

| State               | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `:state(scrolling)` | Present while the page is scrolling; removed ~500 ms after scrolling stops. |
| `:state(active)`    | Present while the inner `pap-treeview` is focused / active.                 |

---

## Contributing

Contributions are welcome! Please follow the development guidelines and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 — Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Related packages

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core) — Core utilities, decorators, and base component class
- [@papit/treeview](https://github.com/onkelhoy/papit/tree/main/packages/atoms/treeview) — Tree view and tree item components used for rendering

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
