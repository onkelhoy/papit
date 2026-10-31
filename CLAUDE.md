# Papit

papit is a zero-dependency ecosystem of `@papit/*` npm packages, built from scratch and published independently. npm workspaces, one repo.

Read `.claude/CATALOG.md` before building or changing anything: it lists every package and what to reuse.

## How we work
- **Plan first.** For anything new, write an ordered task list to `.claude/plan.md` (gitignored) and get it confirmed. Then "do next task" runs one task and stops, so a smaller model can execute after `/clear`. Small fixes need a short plan in chat, not a file.
- **Status after each task.** Keep it very short, the owner asks if they want more:
  ```
  task 3 of 98 done
  <one-line summary>
  <what changed>
  <notes, only if any>
  ```
- **Iterate in thin slices.** Rough working version using existing components first, then behaviour, then edge cases, then tests and docs. Show something visible early so mistakes surface fast.
- **Push back.** Act as a senior IT expert: say when an idea is wrong, name the better option, then follow the owner's decision.
- **Readable first.** Simple logic, clear names, web standards over custom solutions (WAI-ARIA APG, WCAG, native form and DOM APIs).
- **Reuse before building.** Compose existing `@papit/*` packages (`pap-input` etc.). Check `packages/web/design-system` before writing a new part.
- **No subagents.** Work inline.
- **Dependencies:** no runtime deps outside `@papit/*` without a strong reason, flagged to the owner. Known exceptions: `ws`, `chokidar`, `esbuild`, `@microsoft/api-extractor`.

## Saving tokens
- Batch: parallel reads, one combined command, multi-file edits in a single step.
- Keep output short: `git diff --stat` before a full diff, `| tail` on test and build runs, read line ranges rather than whole files.
- Test only the touched package with `npm run test:chrome`. CI runs the full browser matrix.
- Don't load a skill unless the task is in its area.

## Repo map
```
packages/algorithms/   data-structure, deep-merge, math/algebra/{matrix,vector}
packages/game/         engine, confetti
packages/network/      webrtc, signal-server, peer-message, meta-json
packages/runtime/      cli/{arguments,build,bundle-js,bundle-ts,create,information,server,terminal,version},
                       html, lexer, svg-spritesheet
packages/web/          engines/web-component, design-system/{1-foundations,atoms,molecules,pages},
                       themes/theme, tools/{router,signals,translator}
```
`docs/` is outdated (#3), trust the code. Folders with only `lib/`/`.temp/` and no `package.json` are build leftovers.

Package layout: `src/index.ts` (exports), `src/component.ts`, `src/types.ts`, `tests/`, `asset/`, `views/` (web demos), `README.md`, `package.json` (`papit.type` drives tooling).

## Commands
- Root: `npm run build`, `npm test`, `npm start`, `npm run create -- --type=… …` (new packages, never `npx papit-create`).
- Package: `npm run build`, `npm test`, `npm run test:chrome`, `npm start`. Tests run against the built `lib/`, so build first.

## Tests
Keep them simple and add depth later. UI gets a smoke test (role, main interaction) until the design settles. Pure logic (`algorithms`, the web-component engine, parsers, protocol) gets a few real tests from the start, because they're the fastest feedback and engine bugs hit every component.
- Node packages use `node:test`, importing the package by name. Web, browser, game and theme packages use Playwright in `tests/<name>/{index.html,main.js,unit.test.ts}` on :3500.
- No CSS, contrast, pixel or snapshot tests. Read states with `el._internals.states.has("x")`, not `:state()`, because WebKit is flaky.
- Scaffold stubs (`should work`, `available in DOM`) don't count as tests.
- Compare computed floats with a tolerance. In filesystem tests use a temp dir, never the real repo.

## Area rules
- **algorithms:** pure and deterministic, no DOM or I/O. Handle degenerate input explicitly. READMEs state complexity.
- **game:** no allocations or closures per frame, `delta`-based motion, respect `prefers-reduced-motion`. Generic math belongs in `algorithms`.
- **network:** message shapes live only in `peer-message`, so change it first, then both sides in one branch. Every socket, timer and listener is released on `close()`. Validate wire input, never throw from a network callback. Webrtc gets light tests plus a `views/` demo for live testing.
- **runtime:** the repo builds itself with pinned published versions, so keep root `npm run build` passing on every commit. CLI flags are public API. Output via `@papit/terminal`, options via `@papit/arguments`. `create` templates define the repo standard.
- **web:** load `papit-design-system` for components and `papit-web-component` for the engine.

## Code style
Match the file you're in: 4-space indent, Allman braces for control flow, K&R for functions and methods, `// section` comments sparingly. Private handlers are `handle<event>`, bound with `@bind`.

## Git
Stay on the current branch. Never create or switch branches on your own, the owner says which branch and when. Branches are named `{TYPE}/{ISSUE}-short-name`, never work on `main`. Commit as soon as a piece of work is done. Commit format is in `CONTRIBUTING.md`. Issues have a short lowercase title that works as a branch name, one package per issue. Landing work follows `papit-merge-workflow`: squash, `closes: #N`, merge commit.

## Definition of done
1. **code**, zero runtime deps outside `@papit/*`
2. **tests**, real ones with no stubs left
3. **asset/**, present with what the package ships
4. **README**, follows `papit-documentation`
5. **package.json description**, clear and correctly spelled

Done applies at the end of the work, not to each slice.
