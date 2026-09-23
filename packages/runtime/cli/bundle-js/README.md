# @papit/bundle-js

Bundles the JavaScript entry points a package.json declares with esbuild, and skips the build when no source file has changed since the last run.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/bundle-js.svg?logo=npm)](https://www.npmjs.com/package/@papit/bundle-js)

---

# Installation

```bash
npm install @papit/bundle-js esbuild
```

`esbuild` is a peer dependency. Most packages never call this directly: `npx @papit/build` runs it for every package in the workspace.

# Usage

Bundle the package in the current folder:

```js
import { jsBundle, getArguments } from "@papit/bundle-js";

// node build.js --dev
const result = await jsBundle(getArguments(), process.cwd());

if (result === "skipped") console.log("nothing changed");
else if (result.length > 0) console.error(result.map(e => e.input));
```

`args` only needs a `has(key)` method, so a `Set`, `getArguments()` or an `Args` from `@papit/arguments` all work:

```js
await jsBundle(new Set(["force", "prod"]), process.cwd());
```

Follow each entry as it is built:

```js
await jsBundle(new Set(), process.cwd(), undefined, event => {
    if (event.type === "build") console.log(event.entry.output, event.result.errors.length);
});
```

# API

### `jsBundle`

```ts
function jsBundle(
    args: { has(key: string): boolean },
    location: string,
    options?: Partial<Options>,
    onBuild?: (event: OnBuildEvent) => void,
): Promise<"skipped" | Array<{ input: string, result: BuildResult }>>
```

Bundles every import entry point of the package at `location`. Resolves `"skipped"` when nothing changed, otherwise the entries that failed (an empty array on success). Throws when there is no package.json or no entry point.

`options` lets a caller that already has these values (like `@papit/build`) skip reading them again:

| Option | Default | Description |
| --- | --- | --- |
| `tsconfig` | read from `location` | parsed tsconfig |
| `packageJSON` | read from `location` | parsed package.json |
| `entryPoints` | `getEntryPoints(...)` | resolved entry points |
| `entryPointArray` | derived from `entryPoints` | explicit `{ input, output }` list to build instead |
| `esoptions` | `getESOptions(...)` | esbuild options shared by every entry |
| `logLevel` | `"error"` | esbuild log level |
| `externals` | every dependency name | modules left out of the bundle |

### `getEntryPoints`

```ts
function getEntryPoints(location: string, packageJSON: PackageJson, tsconfig: ts.ParsedCommandLine): {
    entries: Record<string, EntryPoint>,
    outputs: Map<string, string>,
    bin: Map<string, string>,
}
```

Maps package.json `main`, `types`, `entryPoints`, `bin` and `exports` to source files. Each output path is mapped from the tsconfig out folder to the source folder with `.js` / `.d.ts` swapped for `.ts`, falling back to `src/index.ts`. The `"."` export and `main` are named `bundle`.

### `getESOptions` / `modifyOptions`

```ts
function getESOptions(args, location: string, options?: Partial<Options>): BuildOptions
function modifyOptions(entry: { input: string, output?: string, name?: string }, options): BuildOptions
```

`getESOptions` builds the shared esbuild options, `modifyOptions` turns them into the options for one entry.

### `hasChanged`

```ts
function hasChanged(location: string, filenames: string[], options?: { tempSuffix?: string, filter?: RegExp | ((file: string) => boolean) }): boolean
```

Compares file modification times against `.temp/mstime.<tempSuffix>.json` and saves the new times. Always includes package.json and tsconfig.json. Default filter: `.css`, `.js`, `.ts`, `.json` and similar.

### Helpers

| Function | Description |
| --- | --- |
| `getArguments()` | `process.argv` flags as a `Set`, with the leading `--` removed |
| `getExternals(packageJSON)` | every dependency, devDependency and peerDependency name |
| `getTSlocation(args, location)` | path to tsconfig.json, or tsconfig.prod.json with `prod` |
| `getTSconfig(args, location, tsconfigLocation?)` | the parsed tsconfig, throws when it can't be read |
| `outFolder(location, tsconfig)` | the out folder relative to `location` |
| `sourceFolder(location, tsconfig)` | the source folder relative to `location` (`baseUrl`, else `src`) |

# Flags

The `args` passed in are checked for these keys:

| Flag | Effect |
| --- | --- |
| `force`, `f` | build even when nothing changed |
| `dev` | no minify or tree shaking, adds sourcemaps and keeps names |
| `prod` | use tsconfig.prod.json when it exists |
| `debug` | print timings (only when run from this package) |

# Build behaviour

- **Format:** `esm` when package.json `type` is `module`, otherwise `cjs`.
- **Platform:** `node` when `papit.type` is `"node"`, otherwise `browser`. `papit.type` can also be a record of entry name to platform.
- **Externals:** all dependencies stay external, so the bundle only holds the package's own code.
- **CSS:** an imported `.css` file becomes a module whose default export is a constructed `CSSStyleSheet`.

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

- [@papit/build](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/build) - runs this and `@papit/bundle-ts` for every package
- [@papit/bundle-ts](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/bundle-ts) - the matching `.d.ts` bundler
