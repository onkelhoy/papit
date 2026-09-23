---
name: papit-testing
description: How papit packages are tested, TDD-first. Node packages use node:test; web components, browser and game packages use Playwright across chromium/firefox/webkit against a test page served by @papit/server. Covers folder layout, what counts as a scaffold stub and the TDD commit order. Load for any code change or test backfill.
---

# Testing

## TDD is mandatory
1. Write the failing test and commit it: `test: [<pkg>] <behaviour>`.
2. Implement until green, as a separate commit (`add` / `feat` / `fix`).
3. Further fixes → their own commits.

When backfilling tests on existing code, commits are naturally test-only. If a backfilled test exposes a bug, the test commit comes first, then the `fix:` commit.

If something genuinely can't be unit-tested (e.g. pure canvas pixel output), stop and flag it to the architect with the reason. Never skip it silently.

## Which runner
Decided by `package.json` → `papit.type` and the `test` script:

| type | runner | test script |
| --- | --- | --- |
| `node` | `node:test` + `node:assert` | `node --test tests/**/*.test.js` |
| `web-component`, `browser`, `game`, `theme` | Playwright | `npx playwright test -c tests/playwright.config.ts` |

Tests import the package **by name** (`import { Vector } from "@papit/vector"`), so they run against the built `lib/`. Run `npm run build` in the package before `npm test`. The root `npm test` (`bin/test.mjs`) runs every package.

## Node layout
```
tests/
  tsconfig.json
  <area>.test.js            e.g. data-structure: queue.test.js, graph.test.js
  <area>/unit.test.js       e.g. runtime/html: element/unit.test.js, query/unit.test.js
```
```js
import { describe, it } from "node:test";
import assert from "node:assert";
import { Vector } from "@papit/vector";

describe("Vector", () => {
    it("computes magnitude", () => {
        assert.strictEqual(new Vector(3, 4).magnitude, 5);
    });
});
```
Reference: `algorithms/math/algebra/matrix` (56 tests), `algorithms/data-structure`.

## Playwright layout
```
tests/
  playwright.config.ts      resolves its dir via PackageGraph; serves on :3500 with @papit/server
  tsconfig.json
  <component>/
    index.html              the fixture page; one element per scenario, each with data-testid
    main.js                 imports the package, wires fixture-only behaviour (e.g. form.onsubmit)
    public/                 icons/, images/, translations/en.json for the page
    unit.test.ts            behaviour tests
    snapshot.test.ts        scaffold leftover, skipped repo-wide; don't add to it
```
Multi-component packages get one folder per component (e.g. menu: `menu/`, `menubar/`, `menuitem/`).

```ts
test.beforeEach(async ({ page }) => { await page.goto("tests/switch/"); });

test("space key toggles checked", async ({ page }) => {
    const target = page.getByTestId("a");
    await target.focus();
    await target.press(" ");
    expect(await target.evaluate((el: any) => el.checked)).toBe(true);
});
```
Reference: `web/design-system/atoms/switch`.

What a web component's suite must cover (as it applies):
- **Role and ARIA** (`toHaveRole`, `aria-*` reflecting state)
- **Keyboard**, per the APG pattern, including Space *and* Enter where the pattern requires both
- **Mouse/pointer**
- **Events** (dispatched, with the right detail, not fired when disabled)
- **disabled / readonly**
- **Form participation** (submit value, reset to default)
- **Client-side creation**: `document.createElement(tag)` returns an upgraded instance with no attributes before connect. This catches constructor-time `setAttribute`.
- **Cleanup**: listeners and observers released on disconnect

**No CSS or visual tests.** Don't assert computed colours, CSS variables, contrast ratios or stylesheet contents, and don't write snapshot tests. They were too unreliable between macOS and the Linux CI and have been dropped. Assume CSS variables are in place. Styling is verified by eye in `views/`.

Read custom states through `el._internals.states.has("x")`, never `el.matches(":state(x)")`. WebKit gets flaky with the latter.

`npm run test:chrome` runs chromium only while iterating. The full three-browser run must pass before merge.

## What counts as a stub
Scaffold leftovers that do **not** count as tests. Replace them, don't pad around them:
- node: `describe('A thing') … it('should work', () => assert.strictEqual(1, 1))`
- Playwright: `test('available in DOM', …)` only checking the element exists, and the `describe.skip("helpers")` block from the template

