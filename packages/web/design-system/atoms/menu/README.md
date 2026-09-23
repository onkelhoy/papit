# @papit/menu

Accessible dropdown menus, submenus and menubars built on the native Popover API, following the WAI-ARIA menu pattern. Use it for action menus and application menubars.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/menu.svg?logo=npm)](https://www.npmjs.com/package/@papit/menu)

---

# Installation

```bash
npm install @papit/menu
```

---

# Usage

## Import

```javascript
import "@papit/menu";
```

This registers `pap-menu`, `pap-menuitem` and `pap-menubar`.

## Menu button

Point any button at the menu with `popovertarget`. The menu opens below it, focuses the first item, and returns focus to the button when it closes.

```html
<button popovertarget="edit-menu">Edit</button>

<pap-menu id="edit-menu">
  <pap-menuitem>Cut</pap-menuitem>
  <pap-menuitem>Copy</pap-menuitem>
  <pap-menuitem>Paste</pap-menuitem>
</pap-menu>
```

## Submenu

Put a `pap-menu` inside a `pap-menuitem`. The item becomes the submenu trigger and gets a `›` indicator.

```html
<pap-menu id="file-menu">
  <pap-menuitem>New</pap-menuitem>
  <pap-menuitem>
    Open Recent
    <pap-menu>
      <pap-menuitem>project-one.txt</pap-menuitem>
      <pap-menuitem>project-two.txt</pap-menuitem>
    </pap-menu>
  </pap-menuitem>
</pap-menu>
```

## Menubar

```html
<pap-menubar aria-label="Application">
  <pap-menuitem placement="bottom-left">
    File
    <pap-menu>
      <pap-menuitem>New</pap-menuitem>
      <pap-menuitem>Save</pap-menuitem>
    </pap-menu>
  </pap-menuitem>
  <pap-menuitem placement="bottom-left">
    Edit
    <pap-menu>
      <pap-menuitem>Undo</pap-menuitem>
      <pap-menuitem>Redo</pap-menuitem>
    </pap-menu>
  </pap-menuitem>
</pap-menubar>
```

## Handling a choice

Leaf items fire `click` for mouse, Enter and Space alike. The keyboard `click` doesn't bubble, so listen on the items.

```javascript
document.querySelectorAll("#edit-menu > pap-menuitem").forEach(item => {
  item.addEventListener("click", () => console.log("chose", item.textContent.trim()));
});
```

---

# Attributes / Properties

## pap-menu

Extends `pap-popover` (`@papit/popover`), so `open`, `placement`, `show()`, `hide()` and `toggle()` work too.

| Attribute   | Property    | Type        | Default    | Description                                           |
| ----------- | ----------- | ----------- | ---------- | ----------------------------------------------------- |
| `data-loop` | `loop`      | `boolean`   | `false`    | Arrow keys wrap from the last item to the first       |
| `open`      | `open`      | `boolean`   | `false`    | Whether the menu is shown                             |
| `placement` | `placement` | `Placement` | `"bottom"` | Side of the trigger to open on (see `@papit/placement`) |
| `popover`   | —           | `string`    | `"auto"`   | Native popover mode; set when missing                 |
| `id`        | `id`        | `string`    | generated  | Used to wire the trigger and anchor                   |

## pap-menuitem

| Attribute   | Property    | Type                                            | Default       | Description                            |
| ----------- | ----------- | ----------------------------------------------- | ------------- | -------------------------------------- |
| `role`      | —           | `"menuitem" \| "menuitemcheckbox" \| "menuitemradio"` | `"menuitem"` | ARIA role; anything else falls back to `menuitem` |
| `placement` | `placement` | `Placement`                                     | `"right-top"` | Where its submenu opens                |
| —           | `submenu`   | `HTMLElement \| undefined`                      | —             | The slotted `pap-menu`, if any (read-only in practice) |

## pap-menubar

No attributes of its own.

---

# Events

| Event   | Element        | Description                                         |
| ------- | -------------- | --------------------------------------------------- |
| `open`  | `pap-menu`     | The menu opened                                     |
| `close` | `pap-menu`     | The menu closed                                     |
| `toggle`| `pap-menu`     | Native popover `ToggleEvent`                        |
| `click` | `pap-menuitem` | A leaf item was chosen (mouse, Enter or Space). The keyboard one doesn't bubble |

---

# Slots

| Element        | Slot      | Description                                                     |
| -------------- | --------- | --------------------------------------------------------------- |
| `pap-menu`     | (default) | `pap-menuitem` elements                                         |
| `pap-menuitem` | (default) | The label, plus an optional `pap-menu` that becomes its submenu |
| `pap-menubar`  | (default) | Top-level `pap-menuitem` elements                               |

---

# Methods

| Element    | Method                  | Description                                                    |
| ---------- | ----------------------- | -------------------------------------------------------------- |
| `pap-menu` | `registerTrigger(el)`   | Make `el` the trigger: sets `popovertarget`, `aria-expanded`, anchor and `aria-labelledby`. Called for you by `pap-menuitem` |
| `pap-menu` | `focusLast()`           | Focus the last item                                            |

---

# Styling

| Element                       | Part    | Description                  |
| ----------------------------- | ------- | ---------------------------- |
| `pap-menu`, `pap-menubar`     | `group` | The `pap-group` around the items |

`pap-menuitem` reads `--background-color` (defaults to `--background`) and picks its text colour with `contrast-color()`.

---

# Keyboard Interaction

## In a menu

| Key                  | Behavior                                                     |
| -------------------- | ------------------------------------------------------------ |
| `ArrowDown` / `ArrowUp` | Next / previous item                                      |
| `Home` / `End`       | First / last item                                            |
| `Enter` / `Space`    | Activate the item, or open its submenu                       |
| `ArrowRight`         | Open the submenu of the focused item                         |
| `ArrowLeft`          | Close the open submenu and focus its trigger                 |
| `Escape`             | Close the menu (native popover light dismiss)                |
| `Tab`                | Leave the menu; it closes and focus returns to the trigger   |

## In a menubar

| Key                     | Behavior                                  |
| ----------------------- | ----------------------------------------- |
| `ArrowLeft` / `ArrowRight` | Previous / next top-level item. On an item with a submenu, `ArrowRight` opens it instead |
| `Home` / `End`          | First / last top-level item               |
| `ArrowDown` / `ArrowUp` | Open the submenu and focus its first item |
| `Enter` / `Space`       | Open the submenu                          |

---

# Accessibility

This component implements the **ARIA Menu and Menubar Pattern** and manages:

- `role="menu"`, `role="menubar"` and `role="menuitem"`
- `aria-haspopup="menu"` and `aria-expanded` on submenu triggers and menu buttons
- `aria-labelledby` from the menu to its trigger
- roving focus through `@papit/group`

Known gaps against the pattern:

- `menuitemcheckbox` and `menuitemradio` are accepted as roles, but `aria-checked` isn't managed.
- No typeahead, and choosing a leaf item doesn't close the menu.
- In a menubar, `ArrowRight` on an item with a submenu opens it rather than moving to the next item.

Reference: [https://www.w3.org/WAI/ARIA/apg/patterns/menubar/](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)

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
- [@papit/popover](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/popover)
  The overlay `pap-menu` extends.
- [@papit/group](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/group)
  Keyboard navigation between items.
- [@papit/placement](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/placement)
  The `placement` values.
