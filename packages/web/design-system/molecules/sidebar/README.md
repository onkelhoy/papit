# @papit/sidebar

A collapsible sidebar navigation panel that expands on click or hover and collapses on click or `Escape`.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-organism-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/sidebar.svg?logo=npm)](https://www.npmjs.com/package/@papit/sidebar)

---

## installation

```bash
npm install @papit/sidebar
```

### to use in **html**

```html
<script type="module" defer>
  import "@papit/sidebar";
</script>

<pap-sidebar>
  <div slot="header">Logo</div>
  <ul>
    <li>Dashboard</li>
    <li>Settings</li>
  </ul>
  <div slot="footer">v1.0.0</div>
</pap-sidebar>
```

## Attributes

| Attribute | Type    | Default | Description                    |
| --------- | ------- | ------- | ------------------------------ |
| `open`    | boolean | `false` | Expands or collapses the panel |

## Slots

| Slot      | Description                                    |
| --------- | ---------------------------------------------- |
| (default) | Main navigation content                        |
| `header`  | Shown at the top, next to the hamburger button |
| `footer`  | Pinned to the bottom of the panel              |

## CSS Parts

| Part        | Description                                 |
| ----------- | ------------------------------------------- |
| `panel`     | Sticky outer wrapper, owns width transition |
| `container` | Fixed inner panel                           |
| `header`    | Header region                               |
| `hamburger` | Toggle button                               |
| `nav`       | Navigation region                           |
| `footer`    | Footer region                               |

## Behavior

- Click the hamburger button, or the empty nav area while collapsed, to open the sidebar.
- Hovering the collapsed nav area previews the expand icon via a `hover` custom state.
- `Escape` closes the sidebar and returns focus to the hamburger button.
- A tooltip on the hamburger button announces "Open sidebar" / "Close sidebar" depending on state.

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
- [@papit/button](https://github.com/onkelhoy/papit): Toggle button used for the hamburger
- [@papit/tooltip](https://github.com/onkelhoy/papit): Tooltip on the hamburger button

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
