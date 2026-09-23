---
name: papit-global
description: Shared mission, repo map, conventions and definition of done for every papit agent (architect, planner, algorithms, game, network, runtime, web). Load this first, always.
---

# Papit — Global Context

## Mission
papit is a zero-dependency ecosystem of `@papit/*` npm packages (web components, game engine, algorithms, networking, CLI tooling), each built from scratch and published independently. The goal is to make **everything**: well-made code, well documented, tested, and properly planned.

## Repo map
One git repo, npm workspaces (`packages/**/*`). Every package is its own publishable npm package.
```
packages/algorithms/   data-structure, deep-merge, math/algebra/{matrix,vector}
packages/game/         engine, confetti
packages/network/      webrtc (browser), signal-server (node), meta-json (node)
packages/runtime/      cli/{arguments,build,bundle-js,bundle-ts,create,information,server,terminal,version},
                       html, lexer, svg-spritesheet
packages/web/          engines/web-component, design-system/{1-foundations,atoms,molecules,pages},
                       themes/theme, tools/{router,signals,translator}
bin/                   root scripts (test.mjs runs every package's `npm test`)
.github/workflows/     pull-request.yml: build + test on every PR to main
docs/                  OUTDATED, don't trust it over code
```
Folders with only `lib/`/`.temp/` and no `package.json` are build output left behind by other branches. They aren't packages on the current branch. Don't recreate them from `lib/`.

## Anatomy of a package
```
src/index.ts          public exports (+ customElements.define for web components)
src/component.ts      main implementation; src/types.ts for exported types
tests/                node:test (*.test.js) or Playwright (tests/<name>/{index.html,main.js,unit.test.ts})
asset/                shipped assets (translations/en.json at minimum)
views/                web only: demo pages served by `npm start`
README.md
package.json          "papit": { type, main, ... } drives build/create tooling
```
Package `papit.type`: `node` (node:test), `web-component` / `browser` / `game` / `theme` (Playwright).

## Commands
Root: `npm run build`, `npm test`, `npm start`, `npm run create` (scaffold a package).
Package: `npm run build`, `npm test`, `npm start` (web: dev server on `views/`).
Tests run against the **built** `lib/`, so build before testing.

## Conventions (full detail in CONTRIBUTING.md)
- Branch: `{feature|bugfix|hotfix|refactor|setup}/{ISSUE-NUMBER}-short-name`
- Commit: `{add|feat|fix|ref|clean|test|docs|version|dep|wip}: message`. Use `[package]` after the colon when a branch spans packages.
- TDD commit order: failing test → implementation → fixes, each its own commit.
- Merge: see the `papit-merge-workflow` skill.

## Definition of done
Before calling any package work finished, check all five:
1. **code** — no runtime deps outside `@papit/*`
2. **tests** — real ones, no scaffold stubs left (`papit-testing`)
3. **asset/** — present with what the package ships
4. **README** — follows the skeleton (`papit-documentation`)
5. **package.json description** — clear, correctly spelled

## Code style
Match the file you're in. The house style: 4-space indent, Allman braces for control flow (`if (...)\n{`), K&R for functions and methods, `// section` comments sparingly. Name private handlers `handle<event>` and bind them with `@bind`.

## Working rules
- Every agent starts its first line with `agent: <name>`.
- Present a plan and wait for confirmation before non-trivial work (continuing approved work on an open branch doesn't need re-confirmation).
- Stay inside your own `packages/<folder>/`. If you need a change elsewhere, stop and flag it to the architect.
- Build from scratch. Never add a runtime dependency without the architect's approval. The known exceptions are `ws` (signal-server), `chokidar`/`esbuild` (server) and `@microsoft/api-extractor` (bundle-ts).
- If a test genuinely isn't feasible, stop and flag it to the architect with the reason. Never skip it silently.
- Status report requested → report status only, start nothing.
