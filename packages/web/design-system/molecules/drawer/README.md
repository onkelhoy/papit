# @papit/drawer

A slide-in drawer panel that can be anchored to any edge of the viewport: `left`, `right`, `top`, or `bottom`. Built on the native `<dialog>` element via `showModal()` for automatic focus-trapping, top-layer rendering, and Escape-key handling out of the box.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/drawer.svg?logo=npm)](https://www.npmjs.com/package/@papit/drawer)

---

## Installation

```bash
npm install @papit/drawer
```

## Usage

### Declarative — `commandfor` / `command`

Any element with `commandfor="<drawer-id>"` and a `command` attribute acts as a trigger. Supported commands: `toggle`, `show-modal`, `show`, `close`.

```html
<script type="module" defer>
  import "@papit/drawer";
</script>

<button commandfor="my-drawer" command="toggle">Open</button>

<pap-drawer id="my-drawer" placement="right" label="Settings">
  <p>Drawer content goes here.</p>
  <button commandfor="my-drawer" command="close">Close</button>
</pap-drawer>
```

### Static (fixed positioning)

Use `static` attribute for fixed sidebars that overlay content instead of pushing it:

```html
<pap-drawer id="sidebar" placement="left" static open>
  <nav>Sidebar navigation</nav>
</pap-drawer>
```

### Imperative

```js
const drawer = document.querySelector("#my-drawer");

drawer.show();
drawer.close();
drawer.toggle();
```

## API

### Attributes

| Attribute             | Type                                     | Default    | Description                                         |
| --------------------- | ---------------------------------------- | ---------- | --------------------------------------------------- |
| `placement`           | `"left" \| "right" \| "top" \| "bottom"` | `"right"`  | Which edge the drawer slides in from                |
| `open`                | `boolean`                                | `false`    | Reflects the open state                             |
| `label`               | `string`                                 | `"drawer"` | `aria-label` on the panel — use a descriptive value |
| `close-outside-click` | `boolean`                                | `true`     | Whether clicking the backdrop closes the drawer     |
| `static`              | `boolean`                                | `false`    | When true, uses fixed positioning (modal overlay)   |

### Methods

| Method     | Description                                        |
| ---------- | -------------------------------------------------- |
| `show()`   | Opens the drawer and traps focus inside            |
| `close()`  | Closes the drawer and returns focus to the trigger |
| `toggle()` | Toggles between open and closed                    |

### CSS Parts

| Part    | Description                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| `panel` | The `<dialog>` element that slides in. The `::backdrop` pseudo-element can be styled via `::part(panel)::backdrop` |

### CSS Custom Properties

| Property        | Default   | Description              |
| --------------- | --------- | ------------------------ |
| `--timing`      | `180ms`   | Open/close transition    |
| `--timing-fast` | `80ms`    | Backdrop fade transition |
| `--shade-1`     | —         | Panel background color   |
| `--space-3`     | `0.75rem` | Panel inner padding      |

## Accessibility

- Uses `<dialog>` with `showModal()` — focus is trapped inside the open drawer automatically by the browser
- Escape key closes the drawer natively
- Focus returns to the triggering element on close
- `aria-label` on the panel describes the drawer to screen readers — always set a meaningful `label`
- Follows the [WAI-ARIA Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

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

## Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core) — Core utilities, decorators, and base component class
- [@papit/dialog](https://github.com/onkelhoy/papit/tree/main/packages/atoms/dialog) — Full-screen modal dialog using the same command pattern

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
