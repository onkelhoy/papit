# @papit/showcase

Page shell for browsing the papit design system: a sidebar, a theme picker and a router that loads each package's demo views. Put your own navigation, routes and footer in its slots.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-pages-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/showcase.svg?logo=npm)](https://www.npmjs.com/package/@papit/showcase)

---

# Installation

```bash
npm install @papit/showcase
```

---

# Usage

```javascript
import "@papit/showcase";
import { translator } from "@papit/translator";

translator.add({ id: "en", url: "/node_modules/@papit/showcase/asset/translations/en.json" });
translator.change("en");
```

```html
<pap-showcase>
    <nav slot="sidebar">
        <a href="#atoms/switch/raw">Switch</a>
    </nav>
    <small slot="footer">Built with papit</small>
</pap-showcase>
```

The built-in route is meant to map `<level>/<package>/<view>` to `/packages/web/design-system/<level>/<package>/views/<view>/`, trying the `raw` view before `experiment`, so serve the page from the repo root.

## Custom routes

Replace the default route through the `path` slot. The router reads the same route attributes as `@papit/router`:

```html
<pap-showcase>
    <div slot="path"
         path=":package/:view"
         realpath="/demos/:package/:view/"
         package="button"
         view="showcase"></div>
</pap-showcase>
```

---

# Attributes / Properties

| Attribute | Property | Type | Default | Description |
| --------- | -------- | ---- | ------- | ----------- |
| `hashbased` | `hashbased` | `boolean` | `true` | Route after `#` in the url. Set `hashbased="false"` for path-based routing |

---

# Slots

| Slot | Description |
| ---- | ----------- |
| `sidebar` | Content of the sidebar, below its header |
| `path` | Route elements for the router. Replaces the default route |
| `footer` | Page footer |

---

# Translations

The sidebar title reads the `sidebar.title` key through `@papit/translator`. `asset/translations/en.json` ships an English file.

---

# Known issues

- Routes don't register yet. The router reads its slot without flattening, so it sees the `path` slot element rather than the routes inside it. This affects the built-in route and custom ones.
- The built-in route's `path` starts with `/`, which the router's matcher doesn't strip.

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

- [@papit/router](https://github.com/onkelhoy/papit/tree/main/packages/web/tools/router)
  Loads the demo pages and defines the route attributes.
- [@papit/sidebar](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/sidebar)
  The sidebar.
- [@papit/theme-picker](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/theme-picker)
  The light, dark and system switch in the header.
- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component)
  The engine it's built on.
