---
name: papit-runtime
description: Conventions for packages/runtime, papit's own toolchain (cli/{arguments,build,bundle-js,bundle-ts,create,information,server,terminal,version}) and node libraries (html, lexer, svg-spritesheet). Covers how the CLI packages depend on each other, the fact that the repo builds itself with them, safe testing of filesystem/process code with node:test, and CLI docs. Load for any runtime work.
---

# Runtime

Load `papit-global` first.

## Packages
```
cli/arguments      flag/value parsing, shared log level
cli/terminal       logging, colours, prompts, spinners, spawn (the base every CLI uses)
cli/information    workspace + package discovery: Information.root, PackageGraph, remote versions
cli/bundle-js      esbuild-based JS bundling, change detection
cli/bundle-ts      .d.ts bundling (currently via @microsoft/api-extractor, which the package aims to replace)
cli/build          `npx @papit/build`: orchestrates bundle-js + bundle-ts per package
cli/server         `npx @papit/server`: dev server resolving local workspace packages, live reload, test server on :3500
cli/version        version flood: bumps propagate to dependants (`version:sync`)
cli/create         `npm create @papit`: interactive scaffolding from asset/*-templates
html               minimal node HTML parser/DOM (uses lexer)
lexer              tokenizer shared by html and others
svg-spritesheet    merges SVG files into one sprite (uses arguments, html)
```

## The repo builds itself with these
The root `devDependencies` pin published versions (e.g. `@papit/build@0.0.1`), and every package's `build`/`start`/`test` shells out to them. So:
- A change here only affects the repo once it's published and re-pinned. Test changes locally with the workspace version (`npx` resolves the workspace package), and state in the PR `note:` if the pinned version needs a bump.
- **Never break the build pipeline mid-branch.** `npm run build` at the root must still pass on every commit you'd want to bisect to.
- Flags are a public API. Renaming or removing one is a breaking change and needs the architect's approval.

## Principles
- CLI output goes through `@papit/terminal`, never raw `console.log` in library code.
- Every CLI takes its options through `@papit/arguments`. Document every flag in the README's `CLI flags` table.
- Pure logic separated from I/O, so the logic is unit-testable without touching disk or spawning processes.
- `create`'s templates (`asset/package-templates`, `asset/component-templates`) define what every new package looks like. Changing them is changing the repo standard, so keep them aligned with `papit-documentation` and `papit-testing` (real README skeleton, and a stub test that fails until replaced rather than one that passes).

## Testing (node:test)
All 8 CLI packages plus svg-spritesheet currently have only the scaffold stub test. That's the largest testing gap in the repo. Approach:
- unit-test the pure parts first (argument parsing, name/folder utils, graph building, version math, colour formatting)
- filesystem code: create a temp dir with `fs.mkdtempSync(path.join(os.tmpdir(), "papit-"))`, build a fake workspace in it, clean it up in `after()`. Never touch the real repo from a test.
- process/spawn code: test the command construction, not the spawned tool.
- interactive prompts (create, terminal): inject answers or test the non-interactive path (`--agree`, explicit flags).
- `html` and `lexer` have real suites. Extend them for every parser bug fixed (the failing input becomes a test case).

## Docs
Follow `papit-documentation`: CLI variant (flags table, then commands/runners), library variant for html/lexer. `create` is missing its package.json description.
