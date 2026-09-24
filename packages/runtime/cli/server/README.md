# @papit/server

Development server for papit workspaces that serves a package together with its workspace dependencies through an import map, bundles TypeScript on request and reloads the page when files change.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/server.svg?logo=npm)](https://www.npmjs.com/package/@papit/server)

---

# Installation

```bash
npm install @papit/server
```

# Usage

Run it from a package folder (or the workspace root) and open the printed port:

```bash
npx @papit/server
```

Rebuild and reload while you edit, as every web package's `npm start` does:

```bash
npx @papit/server --info --live
```

Serve a fixed port for Playwright, as the test configs do:

```bash
npx @papit/server --serve --port=3500
```

Open the browser on a sub folder:

```bash
npx @papit/server --open=views/showcase
```

# CLI flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--port` | number | `3000` | first port to try; the next free one is used, up to 20 tries |
| `--live` | boolean | `false` | watch the workspace, rebuild changed packages and reload open pages |
| `--serve` | boolean | `false` | only serve; skip the build settings applied when run inside another package |
| `--open` | string | - | open the browser, optionally on this path |
| `--folder` | string | - | sub folder every request path is resolved under |
| `--asset` | string (repeatable) | - | extra asset folder names, on top of `asset`, `assets` and `public` |
| `--include-node` | boolean | `false` | also collect assets from `node` type packages |
| `--import-map` | string | `.temp/dependencies` | working folder created at startup; removed on shutdown unless this flag is given |
| `--prod` | boolean | `false` | drop the `Cache-Control: no-store` header on HTML |
| `--no-cache` | boolean | `false` | disable the in-memory caches |
| `--cache-file` | number (MB) | `50` | file cache size |
| `--cache-html` | number (MB) | `50` | HTML cache size |
| `--cache-bundle` | number (MB) | `150` | on-the-fly bundle cache size |
| `--MAX_FILE_SIZE_TO_CACHE` | number (bytes) | `1048576` | larger files are streamed, not cached |
| `--explorer-spritesheet` | string | built-in | spritesheet for the folder explorer icons |
| `--silent`, `--error`, `--info`, `--verbose`, `--debug` | boolean | - | log level, from `@papit/arguments` |

Other flags are passed on to `@papit/build` when `--live` rebuilds a package.

# What it serves

A GET request is answered by the first of these that matches. Other methods get `405`, and a path that matches nothing currently gets `500`.

1. **Translations**: JSON files in a folder whose name starts with `transl`, `locale` or `i18`, merged per language across the workspace.
2. **Assets**: files in asset folders of the served package, its workspace dependencies and the server itself, reachable by any trailing part of their path, so `/icons/x.svg` finds `asset/icons/x.svg`. A package's asset wins over the server's default of the same name.
3. **Themes**: a URL containing the name of a `theme` package serves that theme's built file.
4. **Files**: an absolute path inside the workspace that exists on disk, else the path resolved against the current folder, the package, then the workspace root. A path that resolves outside the workspace root (e.g. through `../`) gets `403`, before anything is read.
5. **Folders**: `index.html` if present, otherwise a file explorer page.
6. **HTML**: merged into the server's page template, which adds the import map and the live reload client. A request with an `x-router` header gets the raw file instead.
7. **TypeScript**: a `.ts` file requested as a script is bundled in memory with `@papit/bundle-js`.

Responses carry `X-Cache: HIT` or `MISS`. `/favicon.ico` falls back to the server's `favicon.svg`.

# Import resolution

At startup the server walks the workspace graph from `@papit/information` and builds one import map:

- every workspace package maps its package.json `exports` (import condition) and `main` to the file on disk
- third-party `dependencies` and `devDependencies` are added the same way from the root `node_modules`, except the build tools (`esbuild`, `typescript`, `chokidar`, `@microsoft/api-extractor`, `playwright`)
- the first mapping for a name wins, and an import map already in the page is merged in, not replaced

So `import "@papit/switch"` in a demo page loads the built `lib/bundle.js` of the workspace package, without a publish or install.

# Live reload

With `--live`, file changes in the workspace (outside `node_modules`, `lib`, `.temp`, `.git` and test folders) are handled per package:

- a change inside the package's source folder rebuilds that package with `@papit/build`, then reloads the pages
- any other change reloads the pages straight away

The pages reloaded are those of the changed package and of every package that depends on it.

Pages register over a WebSocket on the same port.

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

# Related

- [@papit/build](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/build) - rebuilds packages on change
- [@papit/bundle-js](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/bundle-js) - bundles TypeScript requested by the page
- [@papit/information](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/information) - the workspace graph the import map is built from
