# @papit/router

Client-side router element for single-page and multi-page sites. Any child element can declare a route with path variables and fallbacks, and the router fetches the matching HTML page and renders it in place.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-tools-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/router.svg?logo=npm)](https://www.npmjs.com/package/@papit/router)

---

# Installation

```bash
npm install @papit/router
```

---

# Usage

```html
<script type="module">
    import "@papit/router";
</script>

<pap-router>
    <div path="about" realpath="pages/about"></div>
    <div path="docs/:page" realpath="pages/docs/:page"></div>
</pap-router>
```

Navigate by setting `url`:

```javascript
const router = document.querySelector("pap-router");
router.url = "docs/getting-started"; // fetches /pages/docs/getting-started/
```

The fetched page's `<body>` is rendered inside the router. Its `<style>`, `<link rel="stylesheet">` and `<script>` elements are loaded too, and removed again when you navigate away.

## Hash-based routing

For static hosting where every path can't serve the same page:

```html
<pap-router hash-based>
    <div path="hello/:name" realpath="pages/hello"></div>
</pap-router>
```

## Default values and fallbacks

Every other attribute on a route element sets a default for a path variable. `<name>-fallback`, `<name>-fallback-0`, … add values to try in order when the request fails. A value starting with `:` refers to another variable.

```html
<pap-router>
    <div path="showcase/:type/:package/:view"
         realpath="packages/:type/:package/views/:view"
         view="showcase"
         view-fallback=":package"></div>
</pap-router>
```

`realpath-fallback`, `realpath-fallback-0`, … add whole alternative request paths.

## Inside a routed page

Scripts from routed pages are rewritten to run against the router:

- `document.body`, `document.querySelector(...)` and friends resolve inside the router's shadow root.
- `window.addEventListener("load", …)` and `window.onload` fire on each navigation (the router's `window-load` event).
- `window.location.params` (or `location.route`) holds the resolved path variables.
- In styles, `body` selectors are rewritten to the routed body.

---

# API

## Router

```ts
class Router extends CustomElement // <pap-router>
```

Fetches the HTML page for `url` and renders it inside the element. Routes come from slotted children and `addRoute`.

| Attribute | Property | Type | Default | Description |
| --------- | -------- | ---- | ------- | ----------- |
| `url` | `url` | `string` | — | The route to show. Setting it navigates |
| `hash-based` | `hashbased` | `boolean` | `false` | Keep the route after `#` in the browser url |
| `update-url` | `updateurl` | `boolean` | `true` | Push each route to the browser history |
| `update-title` | `updatetitle` | `boolean` | `true` | Copy the routed page's `<title>` to the document |
| `trailing-slash` | `trailingslash` | `boolean` | `true` | End browser urls with `/` |
| `cache` | `cache` | `"session" \| "local"` | — | Cache fetched pages and skip the network on repeat visits |
| — | `omitters` | `string[]` | `["[data-server-omitter]"]` | Selectors removed from every fetched page |

Read-only state:

| Property | Type | Description |
| -------- | ---- | ----------- |
| `params` | `Record<string, string>` | Resolved path variables of the current route |
| `route` | `MappedRoute \| null` | The route currently rendered |
| `routes` | `Route[]` | Every registered route, in match order |

Events:

| Event | Description |
| ----- | ----------- |
| `window-clear` | A new page has been inserted; fired just before `window-load` |
| `window-load` | A new page has been inserted. Routed `load` listeners run here |

## Route elements

Any slotted element with one of these attributes becomes a route:

| Attribute | Description |
| --------- | ----------- |
| `path` (or `url`, `route`) | The route, e.g. `docs/:page`. `:name` is a path variable |
| `realpath` (or `reroute`) | Where to fetch from. Defaults to `path` |
| `realpath-fallback`, `realpath-fallback-<n>` | Alternative fetch paths, tried in order |
| `<name>` | Default value for the variable `:name` |
| `<name>-fallback`, `<name>-fallback-<n>` | Values to try for `:name` when the request fails |

## addRoute

```ts
router.addRoute(route: AddRoute): void
```

Registers a route from code, the same as a route element.

```javascript
router.addRoute({
    url: "hello/:name",
    reroute: ["pages/hello"],
    params: { name: { default: "world", fallback: [] } },
});
```

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `url` | `string` | required | The route |
| `reroute` | `string[]` | `[url]` | Fetch paths, tried in order |
| `params` | `Record<string, Param>` | `{}` | Per variable: `{ default, fallback[] }` |

## Types

`Route`, `AddRoute`, `MappedRoute` and `Param` are exported for use with `addRoute` and `route`.

---

# Limits

- Pages must be served with `content-type: text/html` exactly; anything else throws.
- Requests carry an `x-router: 1` header, so a server can return a partial page.
- `cache` stores pages in `localStorage` whichever value you set.

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
  The engine the router element is built on.
- [@papit/tabs](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/atoms/tabs)
  Tab panels can double as route elements, as in the showcase.
