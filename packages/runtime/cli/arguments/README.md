# @papit/arguments

Parses command-line flags and positional values from process.argv or any argument list, and holds the shared log level every papit CLI reads.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-node-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/arguments.svg?logo=npm)](https://www.npmjs.com/package/@papit/arguments)

---

# Installation

```bash
npm install @papit/arguments
```

# Usage

Importing the package parses `process.argv` once into the shared `Arguments` singleton:

```js
// node cli.js build --out dist --port=3000 --watch
import { Arguments } from "@papit/arguments";

Arguments.string("out");   // "dist"
Arguments.number("port");  // 3000
Arguments.has("watch");    // true
Arguments.has("minify");   // false
```

Parse any list with `Args`:

```js
import { Args } from "@papit/arguments";

const args = new Args(["build", "--tag", "a", "--tag=b", "--out", "dist"]);
args.values;       // ["build"]
args.get("tag");   // ["a", "b"]
args.string("out") // "dist"
```

Mark boolean flags as islands so they don't swallow the next value:

```js
const args = new Args(["--dry", "src"], ["dry"]);
args.has("dry");   // true
args.values;       // ["src"]
```

Branch on the log level:

```js
// node cli.js --verbose
if (Arguments.verbose) console.log("resolving packages…");
Arguments.level;   // "verbose"
```

# API

### `Args`

```ts
class Args extends Loglevel {
    constructor(input: Input, islands?: string[])
    flags: Record<string, string[]>
    values: string[]
}
type Input = string | number | boolean | Array<string | number | boolean>
```

Parses `input` into `flags` and positional `values`, then sets `level` from the log level flags. `islands` lists flag names that never take the following argument as their value.

| Method | Returns | Description |
| --- | --- | --- |
| `get(key)` | `string[] \| undefined` | every value given for `key` |
| `has(key)` | `boolean` | whether the flag was given |
| `true(key)` | `true \| undefined` | `true` when the flag was given, handy for option objects |
| `string(key)` | `string \| undefined` | the first value |
| `number(key)` | `number \| undefined` | the first value as a number, `undefined` if it isn't one |
| `set(key, value)` | `void` | replaces the flag's values |
| `add(key, value)` | `void` | appends to the flag's values |
| `delete(key)` | `void` | removes the flag |
| `toggle(key)` | `void` | sets the flag to `!has(key)` |

### `Arguments`

```ts
class Arguments {
    static instance: Args
    static init(input: Input, islands?: string[]): void
    static get isCLI(): boolean
}
```

A static facade over one shared `Args`, created from `process.argv` on import. `init` only builds the instance if none exists yet, so the import-time parse wins. Every `Args` method and log level accessor is mirrored as a static. `isCLI` is `true` when run through `npx`.

### `Loglevel`

```ts
class Loglevel {
    level: "verbose" | "debug" | "info" | "error" | "warning" | "silent"  // default "silent"
    silent: boolean; error: boolean; warning: boolean
    info: boolean; verbose: boolean; debug: boolean
}
```

Each getter says whether that level is enabled; each setter switches to it (setting `false` steps down one level). Levels include the ones below them:

| Getter | `true` when `level` is |
| --- | --- |
| `error` | error, warning, info, verbose, debug |
| `warning` | warning, info, verbose, debug |
| `info` | info, verbose, debug |
| `verbose` | verbose, debug |
| `debug` | debug |
| `silent` | silent |

# CLI flags

The log level flags every papit CLI understands. With several given, the later row wins. The first non-silent parse prints `log-level: <level>`.

| Flag | Level |
| --- | --- |
| `--error` | `error` |
| `--warning` | `warning` |
| `--info` | `info` |
| `--verbose` | `verbose` |
| `--debug` | `debug` |
| `--silent` | `silent` (also the default) |

# Parsing rules

| Input | Result |
| --- | --- |
| `--name value` | `name: ["value"]`, unless `name` is an island |
| `--name=value` | `name: ["value"]` |
| `--name a --name b` | `name: ["a", "b"]` |
| `-n value` | `n: ["value"]`, a single dash parses like a double |
| `-abc=x` | `a`, `b` and `c` toggled on, `x` dropped |
| anything else | appended to `values` |

`values` from `process.argv` start with the node binary and script path.

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

- [@papit/terminal](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/terminal) - logging, colours and prompts for the same CLIs
