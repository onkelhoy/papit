# @papit/version

Version flood for npm workspaces: when a package is versioned, every package that depends on it gets the new version and a patch bump. It also resets or syncs versions against the npm registry.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-node-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/version.svg?logo=npm)](https://www.npmjs.com/package/@papit/version)

---

# Installation

```bash
npm install -D @papit/version
```

# Usage

Hook it into a package's npm lifecycle:

```json
{
    "scripts": {
        "preversion": "papit-version",
        "postversion": "papit-version"
    }
}
```

Then version the package as usual. Its dependants follow:

```bash
cd packages/runtime/lexer
npm version patch
# @papit/lexer 0.0.1 → 0.0.2
# @papit/html depends on it: dependency set to 0.0.2, version 0.0.1 → 0.0.2
```

Housekeeping from the workspace root:

```bash
npx @papit/version --sync   # record the published npm version of every package
npx @papit/version --reset  # set every package back to its published version
```

# CLI flags

| Flag | Description |
| --- | --- |
| `--pre` | run the `preversion` step (automatic inside `npm version`) |
| `--post` | run the `postversion` step (automatic inside `npm version`) |
| `--force` | let `--pre` continue when the package is already ahead of npm |
| `--sync` | write each package's latest npm version to `remoteVersion` |
| `--reset` | set each package's `version` back to its npm version |

Which packages `--sync` and `--reset` touch follows the batch flags of [@papit/information](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/information#cli-flags): from the root that's every package, `--individual` limits it to the current one. The log level flags from [@papit/arguments](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/arguments#cli-flags) apply too.

# Commands

### pre (`preversion`)

- Fails when the package's `version` already differs from its npm version (or `remoteVersion` when offline), so a package isn't bumped twice between publishes. `--force` skips the check.
- Moves the root `package-lock.json` to `temp-package-lock.json`, so npm doesn't run an install for the workspace mid-version.

### post (`postversion`)

For the versioned package and every package that depends on it, in dependency order:

1. Refresh `remoteVersion` from npm.
2. Set `dependencies`, `devDependencies` and `peerDependencies` on flooded packages to their new versions.
3. Patch-bump the package if a runtime dependency changed (a `*` range doesn't count) or it has never been published, but only if its `version` still equals `remoteVersion`, so it's bumped at most once per publish.
4. Move `temp-package-lock.json` back to `package-lock.json`.

### `--sync`

Sets `remoteVersion` to the latest npm version, or `""` when unpublished. `version` isn't touched.

### `--reset`

Sets `version` (and `remoteVersion`) to the npm version, or `0.0.1` for a package that was never published, and aligns dependency ranges between packages of the root's scope. Useful to undo a flood that was never published.

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

- [@papit/information](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/information) - the workspace graph the flood walks
