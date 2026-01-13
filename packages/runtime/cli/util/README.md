# @papit/util

Low-level CLI utilities for building consistent, interactive Papit command-line tools.

![Logo](https://github.com/onkelhoy/web-components/blob/main/asset/logo.svg)

Shared CLI utilities for Papit tooling — focused on **argument parsing**, **terminal interaction**, **workspace introspection**, and **dependency graph execution** inside monorepos.

This package is **not a CLI by itself**, but a foundational library used by Papit CLIs such as `@papit/build`.
It provides opinionated primitives so all Papit tools behave consistently in terms of flags, output, prompts, and dependency handling.

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/web-components/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/web-components/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/util.svg?logo=npm)](https://www.npmjs.com/package/@papit/util)

---

## Installation

```bash
npm install @papit/util
```

This package is typically consumed **programmatically** by other Papit tools rather than executed directly.

---

## What does this package provide?

### 1. Argument parsing (`Arguments`, `getArguments`)

A lightweight but flexible argument parser with support for:

- Long flags: `--flag`, `--flag=value`
- Short flags: `-f`, `-f value`
- Grouped short flags: `-abc`
- Positional values
- “Island” flags that **do not consume the next argument**

```ts
import { getArguments } from "@papit/util";

const args = getArguments(["verbose", "debug"]);

args.flags; // { verbose: true }
args.values; // ["positional", "values"]
```

#### Built-in log-level handling

The `Arguments` class exposes computed log-level flags with cascading behavior:

```ts
import { Arguments } from "@papit/util";

if (Arguments.verbose) {
  // enabled via --verbose or --debug
}
```

Supported flags:

- `--debug`
- `--verbose`
- `--info`
- `--warning`
- `--error`

---

### 2. Terminal utilities (`Terminal`)

A fully state-aware terminal abstraction for building interactive CLIs.

#### Features

- Colored output (TTY-aware)
- Line tracking and clearing
- Session-based output blocks
- Interactive prompts and selections
- Confirmations and validated input
- Output suppression for noisy operations

#### Examples

##### Writing output

```ts
Terminal.write("Hello world");
Terminal.warn("Something looks off");
Terminal.error("Something went wrong");
```

##### Prompting for input

where input is the user input and path is the potential path output 
```ts
const { input, path } = await Terminal.prompt("Package name");
```

where text is the is the selected text & index -> the position of the options 

##### Interactive selection

```ts
const { index, text } = await Terminal.option(["yes", "no", "maybe"], "Continue?");
```

##### Scoped terminal sessions

```ts
await Terminal.sessionBlock(async () => {
  Terminal.write("Working...");
  // output here can be cleared safely
});
```

---

### 3. Dependency graph execution

Utilities for **monorepo-aware dependency traversal** based on `package-lock.json`.

#### Ordered dependency execution

```ts
import { getDependencyOrder } from "@papit/util";

await getDependencyOrder(async (batch) => {
  for (const pkg of batch) {
    console.log(pkg.name);
  }
});
```

- Executes packages in **topological order**
- Groups independent packages into batches
- Respects workspace scope
- Supports filtering via acceptance sets

#### Dependency bloodlines

```ts
import { getDependencyBloodline } from "@papit/util";

await getDependencyBloodline(
  "@scope/pkg-a",
  async (batch) => {
    // ancestors / descendants / both
  },
  { type: "bloodline" }
);
```

Supported modes:

- `ancestors`
- `descendants`
- `bloodline` (default)

---

### 4. Workspace & package helpers

#### Path & scope utilities

```ts
import { getPathInfo, getScope } from "@papit/util";

const info = getPathInfo();
const scope = getScope();
```

- Detects workspace root
- Resolves local execution context
- Locates calling package automatically

#### Package helpers

```ts
import { getPackage } from "@papit/util";

const pkg = getPackage("@scope/pkg", lockfile);
```

- Resolves local workspace packages
- Works directly against `package-lock.json`

---

### 5. Filesystem utilities

#### Recursive folder copying

```ts
import { copyFolder } from "@papit/util";

await copyFolder(src, dest, (content) => {
  return content.replace("__VERSION__", "1.0.0");
});
```

- Recursively copies directories
- Optional transform/filter function
- Async-safe

---

## Intended usage

This package is designed to be used by:

- Papit CLI tools
- Internal monorepo tooling
- Scripts that need:

  - predictable CLI flags
  - clean terminal UX
  - dependency-aware execution

It intentionally avoids external dependencies and heavy abstractions.

---

## Requirements

- Node.js **>= 18**
- Monorepo with `package-lock.json` for dependency features

---

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/web-components/blob/main/LICENSE) file for full details.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/web-components).
