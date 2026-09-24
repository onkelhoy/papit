# @papit/drawer

A slide-in drawer panel that anchors to the left, right, top or bottom edge of the viewport. A static drawer is a modal overlay with backdrop, focus trap and Escape to close, and the default drawer is an in-flow, non-modal panel that pushes content.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-molecules-orange)
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

### Static (modal overlay)

Use the `static` attribute for a drawer that overlays content instead of pushing it. It opens modally (backdrop, focus trap, Escape to close), also when opened through `open`, `show()` or `toggle`:

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
| `open`                | `boolean`                                | `false`    | Open state; opens modally when `static` is set      |
| `label`               | `string`                                 | `"drawer"` | `aria-label` on the panel — use a descriptive value |
| `close-outside-click` | `boolean`                                | `true`     | Whether clicking the backdrop closes the drawer     |
| `static`              | `boolean`                                | `false`    | Modal overlay when true, in-flow non-modal panel when false |

### Methods

| Method     | Description                                                          |
| ---------- | -------------------------------------------------------------------- |
| `show()`   | Opens the drawer, modally when `static` is set, non-modally otherwise |
| `close()`  | Closes the drawer                                                    |
| `toggle()` | Toggles between open and closed                                      |

### Events

Fired on the host for every open state change after the initial render, including Escape and backdrop clicks.

| Event   | Type    | Description            |
| ------- | ------- | ---------------------- |
| `open`  | `Event` | The drawer was opened. |
| `close` | `Event` | The drawer was closed. |

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

- A `static` drawer opens with `showModal()`: the browser traps focus, makes the page inert and closes it on Escape. Focus returns to the triggering element on close
- The default (non-static) drawer is an in-flow panel opened with `show()`. It is not a modal dialog, so there is no focus trap and Escape does nothing
- `aria-label` on the panel describes the drawer to screen readers — always set a meaningful `label`
- The `static` drawer follows the [WAI-ARIA Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## License

Licensed under the @Papit License 1.0 — Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component) — Core utilities, decorators, and base component class
- [@papit/dialog](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/atoms/dialog) — Full-screen modal dialog using the same command pattern
