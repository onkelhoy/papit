---
name: papit-design-system
description: How @papit web components are designed and built. Covers atomic layers under packages/web/design-system, WAI-ARIA APG patterns and WCAG as the spec, @papit/theme tokens, form association via ElementInternals, :state() styling, constructed stylesheets, scaffolding, and the web tools (router, signals, translator). Load for any design-system, theme or web tool work.
---

# Design system

Load `papit-global` first, plus `papit-web-component` whenever you touch how a component renders or reacts.

## Philosophy
- **From scratch, standards first.** Native platform features (ElementInternals, `:state()`, `adoptedStyleSheets`, `@position-try`, popover, `<dialog>`) over reinvention; reinvention over dependencies.
- **Accessibility is the spec.** Every interactive component implements its [WAI-ARIA APG pattern](https://www.w3.org/WAI/ARIA/apg/patterns/) completely (roles, states, *all* keyboard interactions) and meets WCAG 2.2 AA, including contrast in light and dark. "WCAG compliant" in a description is a promise the tests must back.
- **One package per component** (`@papit/<name>`, tag `pap-<name>`), independently versioned.

## Layers
```
packages/web/design-system/
  1-foundations/  structural building blocks others extend or compose: button, field (form base class),
                  group (keyboard nav), icon, placement (@position-try), popover, treeview
  atoms/          single controls: accordion, carousel, checkbox, dialog, file-input, input, menu, radio,
                  splitter, switch, table-of-content, tabs, tooltip
  molecules/      compositions: codeblock, drawer, sidebar, theme-picker
  pages/          showcase
packages/web/themes/theme   CSS tokens (@papit/theme)
packages/web/tools/         router, signals (browser + node exports), translator
```
A component depends only on its own layer or below. Form controls extend `field` (from `1-foundations`) or `CustomElementInternals`. Keyboard roving goes through `group`.

## Anatomy of a component
```
src/component.ts   class extends CustomElement | CustomElementInternals; `static sheet = sheet`
src/style.css      imported as `import sheet from "./style.css" with { type: "css" }`
src/index.ts       export * + guarded customElements.define("pap-<name>", Class)
src/types.ts       exported types
views/showcase/    demo used by the showcase package; views/experiment/ for scratch
tests/<name>/      Playwright fixture + suites (see papit-testing)
asset/translations/en.json
```
Declare the tag in `HTMLElementTagNameMap`. Scaffold new packages from the repo root with `npm run create`, and new sub-components inside a package with `npm run component`. Both are **interactive** (folder picker + prompts), so ask the user to run them via `! npm run create` rather than hand-copying templates. The templates live in `packages/runtime/cli/create/asset/`.

## Theme tokens (@papit/theme)
Use tokens, never raw values:
- colour: `--primary --secondary --tertiary --success --warning --error --info`, `--background`, `--foreground`, `--text`, `--text-secondary`, `--text-inverse` (+ `-light`/`-dark`/`-inverse` variants), `--shade-0/1`, `--focus-color`
- spacing: `--base-unit`, `--space-1 … --space-20`
- radius: `--radius-small|medium|large|full`

Per-component overrides follow `--<component>-<thing>` falling back to the token, e.g. `var(--button-primary, var(--primary))`. Light/dark follows `color-scheme`, with `data-theme="light|dark|opposite"` to force it. Check both modes by eye in `views/` (no CSS tests, see `papit-testing`).
- Name tokens exactly (`tertiary`, not `tiertery`).
- Modern CSS needs a fallback for Chromium < latest, Firefox and Safari: declare a plain value before `contrast-color()`, and always give `color-mix()` an interpolation space (`color-mix(in srgb, …)`).
- Undefined elements stay hidden (`*:not(:defined) { visibility: hidden }` in theme). An element that never upgrades is invisible, not an error, so test the upgrade explicitly.

## Behaviour rules
- Reflect state to ARIA (`aria-checked`, `aria-expanded`, …) *and* to `:state()` for styling.
- Space **and** Enter where the pattern says so. Space activates on keyup with `preventDefault` on keydown. See switch.
- `disabled` blocks pointer and keyboard. `readonly` blocks change but keeps focus.
- Native events where a native equivalent exists (`change`, `input`), `CustomEvent` with `detail` otherwise. Document every event.
- Clean up in `disconnectedCallback` everything `connectedCallback` added.
- Never `setAttribute` in the constructor (see `papit-web-component`).

## Tools
- `router`: SPA/MPA routing, any element can route.
- `signals`: two entry points, `./browser` and `./node`. Keep them API-identical.
- `translator`: lazy-fetched translations with variable interpolation. Components read strings from `asset/translations/en.json`.

## Reference packages
`atoms/switch` (behaviour + docs + tests done right), `atoms/carousel` / `atoms/accordion` (large real suites), `1-foundations/field` (form base).
