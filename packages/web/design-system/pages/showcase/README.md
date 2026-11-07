# @papit/showcase

Storybook-like site shell for a papit workspace: a package tree, a floating pill menu, README pages, each package's own views, and generated API, assets and translations pages, all driven by one manifest.json.

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

Generate the site, then publish it:

```bash
npm run showcase          # npm create @papit -- --showcase → ./showcase
npm run showcase:static   # @papit/static → ./dist/showcase, for GitHub Pages under /papit/
```

The generated `index.html` is all it takes:

```html
<script type="module">
    import { translator } from "@papit/translator";
    import "@papit/showcase";

    translator.add({ id: "en", url: "/en.json" });
    translator.change("en");
</script>

<pap-showcase manifest="manifest.json"></pap-showcase>
```

Filters and the manifest format are documented in [@papit/create](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/create#showcase).

## Routes

Routing is hash based, so any static host works.

| Hash | Page |
| --- | --- |
| `#/` | the root README |
| `#/<path>` | the package's README, e.g. `#/web/design-system/atoms/switch` |
| `#/<path>/<view>` | one of its `views/` folders, loaded by `pap-router` |
| `#/<path>/api` | playground and API tables from `analyse.json` |
| `#/<path>/assets` | previews of its `asset/` files |
| `#/<path>/translations` | its translations as a table; add languages, export CSV |

The longest package path wins, so nested packages resolve correctly.

---

# API

## pap-showcase

| Attribute | Property | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `manifest` | `manifest` | `string` | `"manifest.json"` | URL of the manifest; package files resolve against its folder |
| — | `data` | `ShowcaseManifest` | — | the loaded manifest, can be set directly |
| — | `route` | `ShowcaseRoute` | `{}` | what the hash resolves to (read-only in practice) |

| Event | Description |
| --- | --- |
| `load` | the manifest has loaded |
| `route` | the hash resolved to a new route; `detail` is the route |

| Slot | Description |
| --- | --- |
| `header` | replaces the theme picker in the pill |
| `language` | replaces the language picker in the pill |
| `footer` | replaces the default footer (version, repository, licence) |

CSS parts: `sidebar`, `home`, `header`, `pill`, `bar`, `current`, `pages`, `separator`, `main`, `readme`, `package`, `package-meta`, `tag`, `view`, `not-found`, `footer`.

## Pill menu

A pill floating over the page: home | package / page | theme | language. Hover, keyboard focus or the package toggle open it downward to the README, views and generated pages of the current package. `Escape` closes it, and the motion is off under `prefers-reduced-motion`.

## Auto pages

`pap-showcase-api`, `pap-showcase-assets` and `pap-showcase-translations` render the generated pages. Each takes the package `entry` and the site `base`; the translations page also takes `packages` (for dependencies) and a `mode` (`focus` or `dependencies`).

## Helpers

```ts
resolveRoute(hash: string, manifest?: ShowcaseManifest): ShowcaseRoute
pagesOf(entry: ShowcaseEntry): string[]          // views, then api / assets / translations when they have data
href(path: string, page?: string): string        // "#/<path>/<page>"
flatten(json): Record<string, string>            // nested translations → dot keys, without meta
toCSV(rows: string[][]): string                  // RFC 4180
```

---

# Translations

Strings live under `showcase`, `sidebar`, `pill` and `footer` in `asset/translations/en.json`.

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

# Related

- [@papit/create](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/create): generates the site folder and manifest
- [@papit/static](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/static): publishes it
- [@papit/router](https://github.com/onkelhoy/papit/tree/main/packages/web/tools/router): loads the package views
- [@papit/sidebar](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/sidebar), [@papit/treeview](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/treeview), [@papit/markdown](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/markdown), [@papit/theme-picker](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/theme-picker), [@papit/language-picker](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/language-picker)
