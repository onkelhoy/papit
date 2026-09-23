# @papit/bundle-ts

Rolls a package's TypeScript declarations up into one .d.ts file per entry point, and skips the work when no source file has changed since the last run.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/bundle-ts.svg?logo=npm)](https://www.npmjs.com/package/@papit/bundle-ts)

---

# Installation

```bash
npm install @papit/bundle-ts typescript
```

`typescript` is a peer dependency. Most packages never call this directly: `npx @papit/build` runs it for every package whose tsconfig has `declaration: true`.

# Usage

Roll up the declarations of the package in the current folder:

```js
import { tsBundle } from "@papit/bundle-ts";

const result = await tsBundle(new Set(), process.cwd());

if (result === "skipped") console.log("nothing changed");
else if (result) result.forEach(e => console.error(e.input, e.logs));
```

With package.json `"types": "./lib/bundle.d.ts"` and `src/index.ts` exporting `hello`, `lib/bundle.d.ts` ends up as:

```ts
export declare const hello: (n: string) => string;

export { }
```

Build explicit entries instead of the ones in package.json:

```js
await tsBundle(new Set(["force"]), process.cwd(), {
    entryPointsArray: [{ input: "/abs/pkg/src/index.ts", output: "/abs/pkg/lib/bundle.d.ts" }],
});
```

# API

### `tsBundle`

```ts
function tsBundle(
    args: { has(key: string): boolean },
    location: string,
    options?: Partial<{
        tsconfig: ts.ParsedCommandLine,
        entryPoints: ReturnType<typeof getEntryPoints>,
        entryPointsArray: { input: string, output: string }[],
        packageJSON: PackageJson,
    }>,
): Promise<"skipped" | Array<{ input: string, logs: string[] }> | undefined>
```

Emits declarations for every file under `src/` into `.temp/ts-bundle`, then rolls each `types` entry up into its output file. Resolves `"skipped"` when nothing changed and every output exists, the entries that logged warnings, or `undefined` on success. On a TypeScript emit error it prints the diagnostics and resolves `undefined`.

Entry points come from package.json through `getEntryPoints` in `@papit/bundle-js`, the same way the JavaScript bundle finds them. `options` lets a caller skip reading them again.

# Flags

The `args` passed in are checked for these keys:

| Flag | Effect |
| --- | --- |
| `force`, `f` | build even when nothing changed |
| `dev` | also emit declaration maps |
| `prod` | use tsconfig.prod.json when it exists |

# Design notes

- The roll-up currently runs on `@microsoft/api-extractor`. The package exists to replace it with a from-scratch bundler, so the dependency is expected to go away.
- Change detection shares `hasChanged` with `@papit/bundle-js`, stored as `.temp/mstime.papit-bundle-ts.json`.

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

- [@papit/build](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/build) - runs this and `@papit/bundle-js` for every package
- [@papit/bundle-js](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/bundle-js) - the matching JavaScript bundler, and where entry points are resolved
