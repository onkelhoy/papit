# @papit/dialog

A simple, accessible wrapper around the native <dialog> element with slot composition, a built-in close button, and support for modal, non-modal, and popover display modes.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/dialog.svg?logo=npm)](https://www.npmjs.com/package/@papit/dialog)

---

## Installation

```bash
npm install @papit/dialog
```

### Use in HTML

```html
<script type="module" defer>
  import "@papit/dialog";
</script>

<pap-dialog id="my-dialog" header="Hello"></pap-dialog>
```

---

## Usage

### Basic modal

Pair any element that has `commandfor` and `command="show-modal"` with the dialog's `id` — no JavaScript required.

```html
<button commandfor="confirm-dialog" command="show-modal">Open</button>

<pap-dialog id="confirm-dialog" header="Confirm action">
  <p>Are you sure you want to continue?</p>
  <div slot="footer">
    <button commandfor="confirm-dialog" command="close">Cancel</button>
    <button>Confirm</button>
  </div>
</pap-dialog>
```

### Non-modal dialog

```html
<button commandfor="info-dialog" command="show">Open non-modal</button>

<pap-dialog id="info-dialog" header="Info">
  <p>This dialog does not block interaction with the rest of the page.</p>
</pap-dialog>
```

### Imperative API

```js
const dialog = document.querySelector("pap-dialog");

dialog.showModal(); // opens as modal with backdrop
dialog.show(); // opens as non-modal
dialog.showPopover(); // opens via Popover API
dialog.close(); // closes the dialog
```

### Close on backdrop click

```html
<pap-dialog header="Click outside to dismiss" close-outside-click>
  <p>Clicking the backdrop will close this dialog.</p>
</pap-dialog>
```

### Custom header slot

When the `header` slot is filled it takes precedence over the `header` attribute.

```html
<pap-dialog>
  <div slot="header">
    <pap-icon name="warning"></pap-icon>
    <strong>Warning</strong>
  </div>
  <p>Something needs your attention.</p>
</pap-dialog>
```

### Footer slot

The footer area is hidden (zero padding) when no content is slotted into it, so it never introduces unwanted whitespace.

```html
<pap-dialog header="Terms">
  <p>Please read the terms carefully.</p>
  <div slot="footer">
    <button>Accept</button>
    <button>Decline</button>
  </div>
</pap-dialog>
```

---

## API

### Attributes / Properties

| Name                  | Type      | Default | Description                                                             |
| --------------------- | --------- | ------- | ----------------------------------------------------------------------- |
| `header`              | `string`  | —       | Text rendered as `<h1>` in the header. Overridden by the `header` slot. |
| `open`                | `boolean` | `false` | Reflects the open state of the underlying `<dialog>`.                   |
| `close-outside-click` | `boolean` | `false` | When set, clicking outside the dialog (on the backdrop) closes it.      |

### Methods

| Method          | Description                              |
| --------------- | ---------------------------------------- |
| `show()`        | Opens as a non-modal dialog.             |
| `showModal()`   | Opens as a modal dialog with a backdrop. |
| `showPopover()` | Opens via the Popover API. (NOT TESTED)  |
| `close()`       | Closes the dialog.                       |

### Slots

| Name        | Description                                              |
| ----------- | -------------------------------------------------------- |
| _(default)_ | Main body content.                                       |
| `header`    | Custom header content. Overrides the `header` attribute. |
| `footer`    | Footer content (e.g. action buttons). Hidden when empty. |

### CSS Parts

| Part     | Description                            |
| -------- | -------------------------------------- |
| `dialog` | The native `<dialog>` element.         |
| `header` | The header bar (title + close button). |
| `main`   | The scrollable main content area.      |
| `footer` | The footer slot container.             |

### Command API

The component integrates with the native `command` / `commandfor` attribute pattern:

| `command` value | Effect                         |
| --------------- | ------------------------------ |
| `show-modal`    | Opens the dialog as a modal.   |
| `show`          | Opens the dialog as non-modal. |
| `close`         | Closes the dialog.             |

The component also responds to `popovertarget` to open via the Popover API.

---

## Accessibility

`pap-dialog` follows the [WAI-ARIA Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):

- The host element carries `role="dialog"`.
- The built-in close button receives `autofocus` when the dialog opens, keeping focus inside the modal.
- `showModal()` traps focus within the dialog and blocks interaction with inert background content, matching the native `<dialog>` behaviour.
- The backdrop provides a visual overlay; combine with `close-outside-click` for pointer-driven dismissal.

---

## Contributing

Contributions are welcome! Please follow the development guidelines and ensure all tests pass before submitting a pull request.

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
- [@papit/icon](https://github.com/onkelhoy/papit/tree/main/packages/atoms/icon): Icon component used for the close button

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
