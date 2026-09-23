---
name: papit-game
description: Conventions for packages/game (@papit/game-engine, @papit/confetti, and the game math returning via issue #110). Covers the engine's canvas/loop/input model, performance rules for per-frame code, and how to test canvas and input code with Playwright. Load for any game work.
---

# Game

Load `papit-global` first.

## Packages
```
packages/game/engine     @papit/game-engine   canvas engine: multi-canvas, 2d/webgl contexts, render loop, input (mouse, touch, keyboard)
packages/game/confetti   @papit/confetti      <pap-confetti> web component with a particle system (depends on @papit/web-component)
```
Math lives in `packages/algorithms` (`@papit/vector`, `@papit/matrix`). The engine consumes `@papit/vector`. Shapes, intersection (SAT, box, circle, line, polygon, triangle) and geometry are being rebuilt on branch `feature/110-game-math` (issue #110). Coordinate with the `algorithms` agent before adding math here: generic math belongs there, game-specific glue belongs here.

## Engine model
- `new Engine(...)` targets one or more canvases (default selector `canvas`, 2d context). Accessors default to index `0`. Issue #108 describes the intended multi-canvas proxy API (`en.canvas1.ctx`) and event API (`en.events.on("e-down")`). Check what's implemented vs planned before documenting it.
- `engine.loop(fn(delta))` is the render loop. `InputEvents` wraps pointer/touch/keyboard with engine-relative positions (`Vector`).

## Performance rules (per-frame code)
- No allocations in hot paths: reuse vectors and matrices, prefer the mutating APIs (see matrix README, "Mutating vs Functional").
- No closures created per frame, no `Array.prototype` chains (`map`/`filter`) inside the loop.
- `delta`-based motion, never frame-count-based.
- Respect `prefers-reduced-motion` for decorative effects (confetti).
- Measure before optimising. Put numbers in the PR `note:` when a change is performance-motivated.

## Testing
Playwright (`tests/game/`, fixture page with a canvas). What's testable and should be:
- engine construction (selectors, multiple canvases, context type), resize behaviour, accessors
- loop start/stop and `delta` being passed (fake time with `page.clock`)
- input: dispatch pointer/keyboard events on the canvas, assert positions, key state and event names
- confetti: element API, particle count/lifecycle state, cleanup on disconnect

Pixel output is covered by `snapshot.test.ts` (currently skipped repo-wide). Don't assert raw pixels in unit tests; test the state that drives them. If something is only verifiable visually, flag it to the architect.

Current state: `game/engine` has only the scaffold stub test, despite about 1200 lines of code. That's the top testing priority here.

## Docs
Follow `papit-documentation`. Game READMEs add a `Design notes` section for performance trade-offs. The engine README's "Quick start" is the model to keep.
