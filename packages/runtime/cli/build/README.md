# @papit/build

Build tool for @papit packages — opinionated, fast, and designed to work seamlessly inside any Papit-based workspace.

This package is intended to be used **from within another package**, where you simply run:

```bash
npx @papit/build
```

and get a fully bundled JavaScript output **plus rolled-up TypeScript declarations**, with zero or minimal configuration.

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/create.svg?logo=npm)](https://www.npmjs.com/package/@papit/create)

---

## Installation

```bash
npm install @papit/build
```

Or use it directly without installing:

```bash
npx @papit/build
```

This is the **recommended usage**.

---

## Usage

Inside any package that follows the Papit conventions, simply run:

```bash
npx @papit/build
```

The build tool will:

1. Detect entry points automatically
2. Bundle JavaScript using **esbuild**
3. Generate and roll up TypeScript declarations using **TypeScript + API Extractor**
4. Respect `package.json` `exports`, `bin`, and custom entry definitions
5. Output files into `lib/`
6. Automatically handle CLI binaries (shebang + permissions)

---

## What gets built?

### JavaScript

- Bundled via **esbuild**
- Minified
- Output format is determined by:

  - `package.json → type` (`esm` or `cjs`)
  - `package.json → papit.type` (`node` or `browser`)

- External dependencies are automatically inferred from:

  - `dependencies`
  - `peerDependencies`

### TypeScript declarations

- Generated with `tsc --emitDeclarationOnly`
- Rolled up into a single `.d.ts` file per entry
- Powered by **@microsoft/api-extractor**

---

## Entry points resolution

Entry points are resolved **in the following order**:

1. `--entry` CLI flag
2. `package.json → entryPoints`
3. `package.json → exports`
4. `package.json → bin`
5. Fallback: `src/index.ts`

### Examples

#### Using `exports`

```json
{
  "exports": {
    ".": {
      "import": "./lib/bundle.js",
      "types": "./lib/bundle.d.ts"
    }
  }
}
```

This will map to:

```
src/index.ts → lib/bundle.js
```

#### CLI binaries

```json
{
  "bin": {
    "@papit/build": "./lib/bundle.js"
  }
}
```

The build tool will:

- Add the Node shebang automatically
- Ensure executable permissions
- Reinstall the bin when needed (non-CI only)

---

## Configuration

### `.config` (required)

A `.config` file must exist in the package root.

It is used to determine things like:

- Target platform (`node` vs browser)
- Template behavior
- Build assumptions

If missing, the build will fail.

---

## CLI Flags

| Flag        | Description                                |
| ----------- | ------------------------------------------ |
| `--dev`     | Use development mode                       |
| `--prod`    | Use production mode (default)              |
| `--verbose` | Show detailed build output                 |
| `--clean`   | Ignore cached build metadata               |
| `--force`   | Force rebuild even if metadata exists      |
| `--ci`      | CI mode (no bin reinstall, no cache write) |
| `--entry`   | Override entry points                      |

---

## Caching & performance

- Build metadata is cached in:

  ```
  .papit/build-meta/{dev|prod}.json
  ```

- Cache is skipped when using:

  - `--clean`
  - `--force`
  - `--ci`

This keeps builds fast during local development.

---

## Requirements

- Node.js **>= 18**
- TypeScript project

---

## Contributing

Contributions are welcome!
Please ensure:

- Code follows existing patterns
- Tests pass
- Changes align with Papit conventions

Open a pull request when ready 🚀

---

## License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Support

For issues, questions, or contributions, please visit the
[GitHub repository](https://github.com/onkelhoy/papit).
