# @papit/static

Command-line tool that turns a papit package folder into a self-contained static site for GitHub Pages, with its pages, assets, merged translations and dependency import map resolved the way @papit/server serves them.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/static.svg?logo=npm)](https://www.npmjs.com/package/@papit/static)

---

# Installation

```bash
npm install @papit/static
```

# Usage

Build the package first (pages import its `lib/`), then run the command from the package folder:

```bash
npx @papit/static
```

With no flags it publishes the first of: the `.html` files in the current folder, `views/github/`, or `views/<package name without scope>/`. Pick another page folder, and prefix every URL for a GitHub project page (`https://<user>.github.io/<repo>/`):

```bash
npx @papit/static -- --target hello --output ./dist --base /papit/
```

# CLI flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--target` | string | see Usage | page folder: `<cwd>/<target>`, else `<cwd>/views/<target>`; a relative path works too |
| `--output` | string | `./dist` | folder the site is written to; must not be, or contain, the page folder |
| `--base` | string | `/` | prefix of every generated URL, e.g. `/papit/` or a full `https://` URL |
| `--asset` | string (repeatable) | - | extra asset folder names, on top of `asset`, `assets` and `public` |
| `--include-node` | boolean | `false` | also collect assets from `node` type packages |
| `--dev` | boolean | `false` | page scripts are not minified and get a source map |
| `--live-template` | string | bundled `asset/templates/static/index.html` | page template each page is merged into |
| `--silent`, `--error`, `--info`, `--verbose`, `--debug` | boolean | silent | log level from `@papit/arguments`; `--info` prints a summary |

The package is the closest `package.json` from the current folder upward. Only the page folder and its subfolders are published, never `tests/`, other `views/` or its asset folders (those go to `public/`).

# Output

```
dist/
  <pages of the page folder>          merged into the template with the import map
  <page scripts>                      .js/.ts bundled and minified; packages stay external
  <other files of the page folder>    e.g. style.css
  lib/<package>/…                     each import map entry's package: a workspace package's built folder, a node_modules package whole
  public/<path below asset folder>    e.g. asset/icons/x.svg → public/icons/x.svg, asset/audio/a.mp3 → public/audio/a.mp3
  public/translations/<lang>.json     one merged file per language (meta.language)
  .nojekyll
```

# How URLs resolve

The workspace graph, assets and translations come from `meta()` in `@papit/server`, every page goes through its `createInline`, and page scripts through `jsBundle` from `@papit/bundle-js`. So the site matches what `npx @papit/server` shows:

- **Import map**: each entry points at `<base>lib/<package>/<file>`. Packages from `node_modules` bring their own dependencies along, transitively. Build and test tooling (`@playwright/test`, `playwright`, `typescript`, `esbuild`, `chokidar`, `@microsoft/api-extractor`, `@types/*`) is left out.
- **Assets**: when two packages ship the same path, the closest package wins and the other copy is skipped. A `node_modules` package's asset folders fill in only the paths still free. The server's own page template and explorer icons are left out.
- **Asset requests**: the dev server answers `/en.json` or `/icons/x.svg` with any asset whose path ends that way. Each page gets a small inline script that sends `fetch` calls for those paths to their file under `<base>public/`, so translators and icon components keep working under a `--base`.
- **CSS `@import`**: in every copied `.css` (page folder, `lib/` and `public/`), both `@import "x";` and `@import url("x");`, keeping any media or layer suffix:
  - `./…`, `../…`, `/…` and URLs with a scheme (`https:`, `data:` …) stay as they are.
  - A bare name with a file of that name next to the stylesheet (e.g. `"reset.css"`) stays as it is.
  - Otherwise the package part (`name` or `@scope/name`) has to be a dependency (a workspace package or a `node_modules` package being copied). The specifier resolves through that package's `exports` (`"."` or the subpath key) or `main`, and is rewritten to `<base>lib/<package>/…`. So `@import "@papit/theme";` loads that package's stylesheet from `lib/`.
  - Anything else stays as it is, with a warning naming the stylesheet and the specifier.

## Limits

- Only `fetch` goes through the asset map. A root-absolute `<img src>` or CSS `url()` isn't rewritten.
- Page scripts are bundled with `@papit/bundle-js`, which needs the package to have a `tsconfig.json` and a `src/` folder.
- A page that loads other folders at runtime (e.g. a router pointing at sibling `views/`) only finds what the page folder holds.
- A static host has no `x-router` raw-HTML response, so a router fetching a page gets the merged page.

# API

```ts
build(options?: StaticOptions): Promise<StaticResult>
```

What the bin runs. It works on `Information.package`, so the process has to run inside the package (the bin uses the current folder).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `cwd` | string | `process.cwd()` | folder `target` and `output` resolve against |
| `target` | string | - | page folder, as `--target` |
| `output` | string | `dist` | folder the site is written to |
| `base` | string | `/` | URL prefix |

`StaticResult` holds the page folder, the page paths written, and the number of assets, languages and `lib/` folders.

The pure helpers behind it are exported too: `resolveTarget`, `normalizeBase`, `assetPath`, `planAssets`, `planTranslations`, `dependencyPath`, `packageEntries`, `isTooling`, `rewriteImportmap`, `resolveSpecifier` and `fetchShim`, plus `rewriteCssImports` (re-exported from `@papit/server`).

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

- [@papit/server](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/server) - the dev server whose resolution this reproduces
- [@papit/information](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/information) - the workspace graph the import map is built from
- [@papit/html](https://github.com/onkelhoy/papit/tree/main/packages/runtime/html) - the parser the pages are merged with
