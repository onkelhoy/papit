# @papit/create

Scaffolds papit packages, components and monorepo projects from templates, interactively or through flags. Run it inside a papit workspace to add a package or component, or outside one to start a new project.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/create.svg?logo=npm)](https://www.npmjs.com/package/@papit/create)

---

# Installation

No install needed:

```bash
npm create @papit
```

It also installs as a dev dependency with the `papit-create` bin:

```bash
npm install -D @papit/create
```

# Usage

Pick a runner from a menu:

```bash
npm create @papit
```

Go straight to a runner (npm needs the `--` to pass the flags on):

```bash
npm create @papit -- --package
npm create @papit -- --component
npm create @papit -- --project
```

The papit repo root wires it up as `npm run create`:

```json
{
  "scripts": {
    "create": "npm create @papit -- --package --html-prefix=pap"
  }
}
```

Fully non-interactive, from inside a workspace:

```bash
npm create @papit -- --package=node --name=my-tool --description="Does a thing." --agree
```

Add `--destination=<folder>` to skip the folder menu too.

A new project without a single prompt (`--destination` must be empty or missing; it is never removed):

```bash
npm create @papit -- --project --name=my-project --description="My things." --destination=./my-project --repository=https://github.com/me/my-project
```

Outside a papit workspace, it always runs the project runner.

# CLI flags

| Flag | Runner | Description |
| --- | --- | --- |
| `--package[=<template>]` | all | Run the package runner. With a value, it's the template too (`browser`, `game`, `node`, `theme`, `web-component` or a custom one). |
| `--component` | all | Run the component runner. |
| `--project` | all | Run the project runner. |
| `--showcase` | all | Run the showcase runner (experimental, see below). |
| `--<custom>` | all | Run a custom runner from `bin/runners/<custom>/`. |
| `--type=<template>` | package, component | Template to use, when `--package` has no value. |
| `--name=<name>` | package, component, project | Name. Spaces and `-` separate words: `my button` becomes `my-button` / `MyButton`. |
| `--description=<text>` | package, project | Description for `package.json` and the README. |
| `--html-prefix=<prefix>` | package, component, showcase | Tag prefix for web components (`pap` gives `pap-<name>`). Falls back to the package's then the root's `papit.htmlprefix`, otherwise prompts. |
| `--agree` | package, component | Yes to everything: folder creation, git commit and `npm install`. |
| `--commit` | package, component | Commit the result without asking. |
| `--install` | package | Run `npm install` without asking. |
| `--yes` / `--no` | package | Answer the commit and install questions. |
| `--destination=<path>` | package, project | Package: folder the package goes in (`<path>/<name>`), created if missing, no menu. Project: the project folder itself; no confirms, and it fails if the folder isn't empty. Relative to the current directory. |
| `--location=<path>` | project | Where to create the project. Default: prompted, then `<path>/<name>`. |
| `--repository=<url>` | project | Repository for the root `package.json` and the README logo. Default `https://github.com/$USER/<name>`. |
| `--license=<id>` | project | License for the generated `package.json`s. Default `MIT`. |
| `--skip-git` | project | Don't `git init` and commit. |
| `--verbose`, `--debug` | all | Log levels, see [@papit/arguments](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/arguments). |

# Runners

## package

1. Pick or create a folder under `packages/` (`--agree` skips the creation confirm), unless `--destination` names it.
2. Pick a template, unless `--package=<template>` or `--type` names one.
3. For a web component, settle the html prefix. When the root has none, it offers to save yours as the root's `papit.htmlprefix`.
4. Ask for name and description. The name must not already exist in the workspace (`<scope>/<name>`).
5. Copy the template into `<folder>/<name>` and replace the [template variables](#template-variables). `.gitkeep` files are dropped.
6. Run the component runner for a first component with the package's own name, using the component template of the same type.
7. Install and commit (`add: <scope>/<name> package`), when agreed.

## component

Adds a component to the package you're in. The template is the package's `papit.type`, then `--package` / `--type`, otherwise prompted. It registers the component under `papit.components` in the package's `package.json`, then copies each top-level template folder:

| Template folder | Goes to |
| --- | --- |
| `src` | `src/` when it's empty, otherwise `src/components/<name>/` |
| `tests`, `views`, others | `<folder>/<name>/` |

The first component of a new package lands directly in `src/` and in `views/experiment/`. Commits as `add: <name> component` when agreed.

## project

Creates a new papit monorepo from the [project template](#project-template): prompts for name, description and location, asks before replacing an existing folder (with `--destination`: no prompts, and a non-empty folder is an error), copies the template, renames its `gitignore` to `.gitignore`, then `git init`, commits (`init: <name> initialized`) and runs `npm install`. The root package is named `@<name>/root`, with `repository.url` set from `--repository`.

## showcase

Experimental. For every `web-component`, `game` and `theme` package in the workspace whose first view isn't `views/showcase`, it generates one from `asset/showcase-templates/individual`, with a tab per existing view (`--view-filter`, default `showcase`, `raw`, `experiment`).

## Custom runners

Any folder in `<workspace-root>/bin/runners/` with a `runner.js` becomes a runner, listed in the menu and selectable as `--<folder>`. The names `package`, `component`, `project` and `showcase` are taken.

```js
// bin/runners/release-notes/runner.js
import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";

export default async function () {
    console.log(Information.root.location, Arguments.string("since"));
}
```

The default export is called with no arguments. Read flags and the workspace through [@papit/arguments](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/arguments) and [@papit/information](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/information).

## Custom templates

| Location | Requirement |
| --- | --- |
| `bin/runners/package/<template>/` | Must contain a `package.json`. |
| `bin/runners/component/<template>/` | Top-level folders are copied as in the [component runner](#component). |

They're listed next to the built-in ones and selected by name. The project runner has no custom templates.

# Package templates

Every package template has `package.json`, `README.md`, `tsconfig.json`, `tsconfig.prod.json`, `.gitignore` and `asset/translations/en.json`. Scripts include `build` (`npx @papit/build`), `test`, `start` and `component`.

| Template | `papit.type` | Gets |
| --- | --- | --- |
| `browser` | `browser` | Playwright tests, `asset/icons`, `asset/images`. |
| `game` | `game` | Playwright tests, `views/`, `asset/models`, `asset/textures`. |
| `node` | `node` | `node:test` tests (`npm test`, `npm run test:only`), `npm start` builds and runs `lib/bundle.js`. |
| `theme` | `theme` | Ships `lib/theme.css` as the package export. Playwright tests. No build script. |
| `web-component` | `web-component` | Playwright tests, `views/`, `@papit/web-component` as a dependency, `papit.htmlprefix`. |

## web-component

On top of the above, a web component package gets:

- `"analyse": "npx @papit/analyse"`, which writes `analyse.json` (see [@papit/analyse](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/analyse))
- `"generate:react": "npx @papit/react"`, which writes `src/react-wrapper.tsx` (see [@papit/react](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/react))
- `react` `^19` as an optional peerDependency, tsconfig `"jsx": "react-jsx"` and `paths` mapping the package's own name to `./index`

The `./react` export isn't in the template. Add it by hand once `src/react-wrapper.tsx` has been generated, so the import path is `@papit/<name>/react`:

```json
"./react": { "import": "./lib/react-wrapper.js", "types": "./lib/react-wrapper.d.ts" }
```

Without the file, `@papit/bundle-js` would build that entry from `src/index.ts` instead.

# Component templates

One per package type, each filled in with the component's name:

| Template | `src` | `tests` | `views` |
| --- | --- | --- | --- |
| `browser` | `component.ts`, `index.ts`, `types.ts` | Playwright `unit.test.ts`, `snapshot.test.ts`, test page | demo page |
| `game` | `component.ts`, `index.ts`, `types.ts` | Playwright `unit.test.ts`, `snapshot.test.ts`, test page | demo page |
| `node` | `component.ts`, `index.ts`, `types.ts` | `unit.test.js` | none |
| `theme` | `theme.css` | Playwright `unit.test.ts`, `snapshot.test.ts`, test page | demo page |
| `web-component` | a `CustomElement` class, `style.css`, `types.ts`, `index.ts` that defines `<prefix>-<name>` | Playwright `unit.test.ts`, `snapshot.test.ts`, test page | demo page |

# Project template

A root `package.json` with npm workspaces (`packages/**/*`, excluding `asset/` and `dist/` folders) and these scripts:

| Script | Runs |
| --- | --- |
| `analyse` | Every workspace's `analyse` script (`npm run analyse --workspaces --if-present`). |
| `build` | `npx @papit/build` |
| `test` | `node bin/test.mjs`, every package's `npm test`. |
| `start` | `npx @papit/server --serve --info` |
| `create` | `npm create @papit -- --package` |
| `clean` | `node bin/clean.mjs` |
| `version:reset`, `version:sync` | `npx @papit/version --reset` / `--sync` |

devDependencies: `@papit/build`, `@papit/bundle-js`, `@papit/bundle-ts`, `@papit/server`, `@papit/create`, `@papit/version`, `@papit/arguments`, `@papit/terminal`, `@papit/information`, `@papit/analyse`, `@papit/react`, `esbuild` and `typescript`. A project that uses `generate:react` adds `react` and `@types/react` as root devDependencies itself.

Also included: `.gitignore` (ignores `packages/**/lib/`, `packages/**/dist/` and the generated `packages/**/analyse.json`; shipped as `gitignore` because npm never publishes `.gitignore` files), GitHub workflows for pull requests and publishing, `.vscode` settings, `.nvmrc`, `bin/` helpers and an example custom runner in `bin/runners/example-runner/`.

# Template variables

Replaced in every copied file.

| Variable | Package | Component | Project | Value |
| --- | :-: | :-: | :-: | --- |
| `VARIABLE_NAME` | ✓ | ✓ | ✓ | Kebab-case name. Project: `@<name>/root`. |
| `VARIABLE_FULL_NAME` | ✓ | ✓ | | `<scope>/<name>`. Component: the package's name. |
| `VARIABLE_CLASS_NAME` | ✓ | ✓ | | PascalCase name. |
| `VARIABLE_HTML_NAME` | ✓ | ✓ | | `<prefix>-<name>` |
| `VARIABLE_HTML_PREFIX` | ✓ | | | The html prefix, or empty. |
| `VARIABLE_DESCRIPTION` | ✓ | | ✓ | The description. |
| `VARIABLE_LAYER_FOLDER` | ✓ | | | Name of the folder the package goes in, e.g. `atoms`. |
| `VARIABLE_LOCAL_DESTINATION` | ✓ | | | Package path from the workspace root. |
| `VARIABLE_GITHUB_REPO` | ✓ | | ✓ | Root `repository.url` without `git+` and `.git`. Project: `--repository`. |
| `VARIABLE_LOGO` | ✓ | | ✓ | `asset/logo.svg` of that repository, see [getLogoURL](#getlogourl). |
| `VARIABLE_PROJECTLICENSE` | ✓ | | ✓ | Root `license` (default `MIT`). Project: `--license`. |
| `VARIABLE_USER` | ✓ | | ✓ | `$USER`, prompted when unset. |

# API

The CLI is the main surface. One helper is exported:

## getLogoURL

```ts
getLogoURL(repository: string): string
```

Logo URL for a repository URL. GitHub (`git+https://github.com/acc/repo.git`, `https://github.com/acc/repo`, `git@github.com:acc/repo.git`) gives `https://raw.githubusercontent.com/acc/repo/refs/heads/main/asset/logo.svg`; other hosts give `<repo>/blob/main/asset/logo.svg`.

```js
import { getLogoURL } from "@papit/create";
```

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

- [@papit/information](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/information)
  Finds the workspace root, its scope and existing packages.
- [@papit/arguments](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/arguments)
  Parses the flags.
- [@papit/build](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/build)
  Builds the packages it creates.
- [@papit/analyse](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/analyse)
  Behind the web component template's `analyse` script.
- [@papit/react](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/react)
  Behind the web component template's `generate:react` script.
