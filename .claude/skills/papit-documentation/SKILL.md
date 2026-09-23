---
name: papit-documentation
description: How every papit package is documented. Covers the README skeleton (shared by all package types, with web/node/game variations), lean JSDoc rules for the public API, and package.json description rules. Load for any work that adds or changes a package's public surface, and whenever writing or fixing a README.
---

# Documentation

Every package documents the same way, whatever folder it lives in. The goal is that a stranger can install it, use it and know its limits in a couple of minutes. **Too much text is a failure too.** Prefer a table or a short example over a paragraph.

References that get it right: `web/design-system/atoms/switch` (web component), `algorithms/math/algebra/matrix` (library).

## README skeleton
Sections in this order. Leave out a section that has nothing real to say. Never keep placeholder text.

```markdown
# @papit/<name>

<1–2 sentences: what it is and when to reach for it. Same wording as package.json description. Plain text only.>

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-<atoms|molecules|node|game|...>-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/<name>.svg?logo=npm)](https://www.npmjs.com/package/@papit/<name>)

---

# Installation
# Usage              ← smallest working example first, then 2–4 common variations
# API                ← tables, see below
# <Domain sections>  ← only what the package needs (see variations)
# License            ← standard block, copy from switch
# Related            ← only real, existing packages; links must resolve
```

### API tables per type
- **Web component:** `Attributes / Properties` (attribute, property, type, default, description), `Events`, `Slots`, `CSS parts / custom properties / :state()`, `Methods`. Add `Keyboard interaction` and `Accessibility` (with the WAI-ARIA APG pattern link) for anything interactive. Add `Form support` if form-associated.
- **Library (node / browser / game):** one subsection per exported class or function with the signature in a code block, a one-line purpose, and a table for options. Add `Types` only for exported types a user must build themselves.
- **CLI:** a `CLI flags` table, then what each runner/command does.

### Variations
- Performance-sensitive (math, game) → a short `Design notes` section with the trade-offs, e.g. mutating vs functional, allocation-free.
- Anything with a "why not X" story → keep it to three bullets max.

### Rules
- Every code example must actually run against the current API. Check it against `src/`.
- Headings must describe the package, not the template. `## Contributing` boilerplate isn't needed; the repo's `CONTRIBUTING.md` covers it.
- Don't link `packages/system/core` (it no longer exists, and 35 READMEs still do). The engine lives at `packages/web/engines/web-component`. Fix the link whenever you touch one of those READMEs.
- Web components get a `views/showcase` demo too. Keep it in sync with the README examples.

## JSDoc
JSDoc goes on the **public API**: exported classes, functions, public methods and properties, custom events. It should add what the type signature can't.

```ts
/**
 * Accessible on/off toggle following the WAI-ARIA switch pattern.
 * Participates in forms; submits `"true"` when checked, nothing when off.
 *
 * @element pap-switch
 * @fires change - whenever `checked` changes
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/switch/
 */
```
- 1–3 lines of description. The why and the non-obvious, never a restated name ("Gets the value").
- Use tags where they carry information: `@param` only when the name + type isn't self-explanatory, `@returns` when not obvious, `@throws`, `@fires`, `@element`, `@example` for tricky call shapes, `@default` for non-obvious defaults, `@see` for specs.
- Private helpers: no JSDoc. A `//` comment only where the logic is surprising.
- `@papit/switch`'s class JSDoc runs about 40 lines, which is at the upper limit. Most things need 2–6.

## package.json description
- 1–2 sentences, spelled correctly, matching the README intro.
- **The first sentence under the README title is plain text, always.** No `*`, backticks, links or `<tags>`. npm listings render it raw, so markdown shows up as stray symbols.
- Say what it is and when to reach for it. No "a simple…" filler, no marketing.
- Update `keywords` alongside it (`papit` + domain terms).
- Known bad ones to fix when touched: `deep-merge` ("witg"), "complient"/"comlient" in several web packages, `runtime/cli/create` (missing).

## Checklist before calling docs done
- [ ] README follows the skeleton, no template leftovers, all links resolve
- [ ] Every README example runs against current `src/`
- [ ] Public exports have lean JSDoc
- [ ] package.json `description` + `keywords` updated
- [ ] Web: `views/showcase` matches the README
