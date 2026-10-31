# Papit catalog

Every package, in one line, so nothing gets rebuilt by accident. Names are `@papit/<name>`, web tags are `pap-<name>`. Details live in each package README.

## The aim
Papit runs itself: its own build, server, CLI, parser and UI. The goal is full independence from outside dependencies. UI priorities are WCAG, then simple, elegant, minimal design. The theme is black and white (`--primary` is black in light mode), and everything stays easy to tweak.

## Reuse rule
Before building, look here. If a part looks or behaves like an existing one, compose it.
- Something button-like uses `pap-button`. A plain native button is fine only when it shares no style or behaviour with it.
- A select composes what exists: `field`/`input` for the control, `menu` or `popover` for the list. Branch `feature/8-select` exists, check it first.
- Icons use `pap-icon`, user-facing text uses `translator`, colours and spacing use `theme` tokens, shared state uses `signals`, keyboard focus groups use `group`.
- Layers are by dependency: foundations → atoms → molecules → pages. A package only depends on layers below or beside it.

## web
**Engine:** `web-component`, base classes, decorators and an `html` template. Reactivity uses a part system. Everything in the design system extends it.

**Tools**
- `theme`: CSS tokens (colours, spacing, radii) for light and dark
- `signals`: signals and effects
- `translator`: language store, lazy loading (uses signals)
- `router`: client-side router element. Barely tested in real use and had problems, expect updates

**1-foundations** (used by the layers above)
- `button`: form-associated button
- `field`: base class for form fields, validation and messages
- `group`: non-visual roving tabindex container
- `icon`: inline SVG from URL, spritesheet or registry, plus flags
- `placement`: positions content beside an anchor, optional arrow
- `popover`: overlay on the native Popover API and CSS anchoring
- `treeview`: WAI-ARIA tree

**atoms**
- `accordion`: button, group, icon
- `carousel`: button, group, icon, translator
- `checkbox`: form-associated, indeterminate state
- `dialog`: native dialog wrapper, icon
- `file-input`: drag and drop, progress; button, icon, translator
- `input`: text input, masking, password toggle, clear; field, icon
- `menu`: dropdowns, submenus, menubars; button, group, placement, popover
- `radio`: radio group pattern
- `splitter`: resizable panes
- `switch`: on/off toggle, form-associated
- `table-of-content`: heading tree; treeview
- `tabs`: button, group
- `tooltip`: hover and focus hint; popover

**molecules**
- `codeblock`: highlight and live preview; lexer, splitter, button, tooltip and more
- `drawer`: edge panel; dialog
- `markdown`: renders markdown; lexer
- `sidebar`: collapsible nav; drawer, treeview, button, tooltip
- `theme-picker`: light, dark, system; button, menu, tooltip

**pages**
- `showcase`: demo and docs site; router, sidebar, theme-picker

## runtime
- `information`: workspace packages, dependency graph, build order. The other CLI tools build on it
- `build`: builds a package or its ancestors, using information, bundle-js and bundle-ts
- `bundle-js`: esbuild entry points, skips unchanged
- `bundle-ts`: rolls up `.d.ts` files
- `create`: scaffolds packages, components, projects and showcases; templates in `asset/` define the repo standard
- `server`: dev server, finds assets and translations across packages, live rebuild
- `static`: static site output for GitHub Pages. Reuses server code heavily (could be flipped one day, fine for now)
- `version`: version flood, patches every dependent using information
- `terminal`: CLI output, colours, spinners, prompts, menu pickers, shell commands
- `arguments`: maps CLI flags and values, log level
- `analyse`: writes `analyse.json` describing a component's API
- `react`: generates React wrappers from analyse
- `html`: HTML parser with a DOM-like tree (uses lexer)
- `lexer`: state machine lexer with HTML, markdown and other languages
- `svg-spritesheet`: merges SVGs into one spritesheet

## algorithms
- `data-structure`: classic structures (graph, priority queue and more)
- `deep-merge`: recursive object merge
- `vector`, `matrix`: fast math for games and graphics

## network
- `meta-json`: binary container of JSON metadata plus payload
- `peer-message`: the only home of message shapes and the protocol
- `signal-server`: WebSocket signalling for webrtc, stateless web push
- `webrtc`: browser peer-to-peer with pluggable topology

## game
- `engine`: 2D and 3D game engine
- `confetti`: confetti web component

## Tests
Tests exist to catch breakage in dependents when a shared package changes, so anything others depend on needs real coverage.
