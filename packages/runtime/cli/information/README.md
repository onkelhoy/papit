# @papit/information

Discovers the packages in an npm workspace and the dependency graph between them, with build order, source and output folders, and published npm versions. The papit CLIs use it to decide which packages to act on.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-node-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/information.svg?logo=npm)](https://www.npmjs.com/package/@papit/information)

---

# Installation

```bash
npm install @papit/information
```

# Usage

Run from anywhere inside a workspace. The graph is built when the module loads:

```js
import { PackageGraph, Information } from "@papit/information";

Information.root.name;      // "@papit/root"
Information.packageName;    // the package you're standing in, e.g. "@papit/html"

const node = PackageGraph.get("@papit/html");
node.location;              // absolute path
node.packageJSON.version;   // "0.0.1"
node.outFolder;             // "lib"
await node.remote();        // latest version on npm, or null
```

Walk the dependency graph:

```js
PackageGraph.getAncestors("@papit/html").map(n => n.name);    // what it depends on: ["@papit/lexer"]
PackageGraph.getDescendants("@papit/lexer").map(n => n.name); // everything that depends on it
```

Get build batches for the current package, driven by the CLI flags below:

```js
// node build.js --ancestors   (inside packages/runtime/html)
Information.getBatches().map(batch => batch.map(n => n.name));
// [["@papit/lexer"], ["@papit/html"]]
```

# API

### `PackageGraph`

```ts
class PackageGraph {
    static root: PackageNode<RootPackage>
    static nodes: PackageNode[]
    static size: number
    static ERROR: boolean
    static get(name: string): PackageNode | undefined
    static search(location: string, compare?: "start" | "end"): PackageNode | undefined
    static getAncestors(name: string, typeFilter?: string[]): PackageNode[]
    static getDescendants(name: string, typeFilter?: string[]): PackageNode[]
    static getOrder(packages: PackageNode[], typeFilter?: string[], filterCallback?: (node) => boolean): PackageNode[][]
    static add(location: string): PackageNode
    static initialize(): void
}
```

The workspace root is the nearest folder upwards from `process.cwd()` whose `package.json` has `workspaces`. Every `package.json` under its `packages/` folder becomes a node, except those in an `asset/` folder or with `papit.skip`. Edges come from dependencies that share the root's scope.

| Member | Description |
| --- | --- |
| `nodes` | every package, the root included |
| `ERROR` | `true` if building the graph threw (the error is logged) |
| `search` | first node whose location ends with (`"end"`, default) or is a prefix of (`"start"`) `location` |
| `getAncestors` | the packages `name` depends on, transitively. `typeFilter` limits the edge kinds: `dependencies`, `peerDependencies`, `devDependencies` (default all) |
| `getDescendants` | the packages that depend on `name`, transitively |
| `getOrder` | topologically sorted batches; packages within a batch don't depend on each other. Packages left out by `typeFilter` are appended as a last batch |
| `add` | adds the package at `location` to the graph |
| `initialize` | rebuilds the graph, e.g. after changing directory |

### `PackageNode`

```ts
class PackageNode<T = LocalPackage> extends GraphNode {
    name: string
    type: "root" | "local" | "external"
    location: string
    packageJSON: T
    sourceFolder: string
    outFolder: string
    externals: string[]
    entrypoints
    tsconfig
    tsconfigpath: string
    modifiedtime: { current: number, previous: number | undefined }
    remote(): Promise<string | null>
    savePackageJSON(): void
}
```

| Member | Description |
| --- | --- |
| `sourceFolder` / `outFolder` | relative folders taken from the package's tsconfig |
| `externals`, `entrypoints`, `tsconfig` | resolved through `@papit/bundle-js` |
| `tsconfigpath` | `tsconfig.prod.json` with `--prod` (when it exists), else `tsconfig.json`. Throws if there's none |
| `modifiedtime` | newest mtime across the source folder, `package.json` and `tsconfig.json`, plus the one recorded last time. Reading it records `current` in `<root>/.temp/cache.json` |
| `remote()` | latest published version from the npm registry, `null` if unpublished or offline |
| `savePackageJSON()` | writes `packageJSON` back to disk with 4-space indent |

### `Information`

Static shortcuts for the package the process runs in (found from `PWD`, falling back to `process.cwd()`).

| Member | Description |
| --- | --- |
| `root` | the workspace root node |
| `scope` | the root name's scope, e.g. `@papit` |
| `local` | the current directory |
| `package` | the node whose location is the longest prefix of `local` |
| `packageName`, `location`, `sourceFolder`, `outFolder` | shortcuts on `package` |
| `getBatches(args?, filterCallback?)` | build batches picked by the CLI flags below |
| `getPriorityBatches(args?, filterCallback?)` | `getBatches`, with packages that set `papit.priority` pulled into a first batch ordered by priority (the current package is never pulled). The first batch can be empty |

### `Remote`

```ts
Remote.get(name: string): Promise<string | null>
Remote.init(scope: string, size?: number, from?: number): Promise<void>
```

Looks up latest published versions and caches them in `Remote.map`. With `--allow-global`, the first lookup fetches the whole scope in one registry search; otherwise each name is fetched on its own.

# CLI flags

Read from `@papit/arguments` by `getBatches`, `PackageNode` and `Remote`, so every CLI built on them accepts these:

| Flag | Effect |
| --- | --- |
| `--all` | every package in the workspace (also the default when run at the root) |
| `--ancestors` | the current package and what it depends on |
| `--descendants` | the current package and what depends on it |
| `--bloodline` | ancestors, the current package and descendants |
| `--individual` | only the current package, overriding the flags above (the default) |
| `--type-filter <kind>` | edge kinds to follow, repeatable: `dependencies`, `peerDependencies`, `devDependencies` (default all three) |
| `--prod` | resolve folders and entry points from `tsconfig.prod.json` |
| `--allow-global` | fetch remote versions for the whole scope in one request |

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

- [@papit/arguments](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/arguments) - the flags above
- [@papit/data-structure](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/data-structure) - the graph underneath
- [@papit/version](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/version) - version flood built on this graph
