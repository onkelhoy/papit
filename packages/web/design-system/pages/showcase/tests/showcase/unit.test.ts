import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/showcase/');
    await page.waitForFunction(() => !!document.querySelector("pap-showcase")?.data);
});

test.describe("@papit/showcase sidebar", () => {
    test("renders the manifest tree as a navigation tree", async ({ page }) => {
        const tree = page.locator("pap-showcase pap-treeview[part=packages]");
        await expect(tree).toBeVisible();
        // folders start collapsed, so only the top level is exposed
        await expect(tree.getByRole("treeitem")).toHaveCount(2);
        await tree.getByRole("treeitem", { name: "web" }).click();
        await expect(tree.getByRole("treeitem", { name: "atoms" })).toBeVisible();
    });

    test("clicking a package sets the hash and resolves the route", async ({ page }) => {
        await page.locator("pap-showcase").getByRole("treeitem", { name: "runtime" }).click();
        await page.locator("pap-showcase pap-sidebar").getByRole("link", { name: "lexer" }).click();

        await expect(page).toHaveURL(/#\/runtime\/lexer$/);
        await expect.poll(() => page.evaluate(() => document.querySelector("pap-showcase")!.route.entry?.name)).toBe("@papit/lexer");
    });

    test("opens the folders of the current package", async ({ page }) => {
        await page.goto('tests/showcase/#/web/atoms/input');
        await page.waitForFunction(() => !!document.querySelector("pap-showcase")?.data);

        const atoms = page.locator("pap-showcase").getByRole("treeitem", { name: "atoms" });
        await expect(atoms).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator("pap-showcase").getByRole("link", { name: "input" })).toHaveAttribute("aria-current", "page");
    });
});

test.describe("@papit/showcase route", () => {
    test("resolves home, package, page and unknown hashes", async ({ page }) => {
        const routes = await page.evaluate(() => {
            const el = document.querySelector("pap-showcase")!;
            const resolve = (hash: string) => {
                const route = (window as any).resolveRoute(hash, el.data);
                return { name: route.entry?.name, page: route.page, unknown: route.unknown };
            };
            return {
                home: resolve(""),
                slash: resolve("#/"),
                readme: resolve("#/web/atoms/input/"),
                view: resolve("#/web/atoms/input/showcase"),
                deep: resolve("#/web/atoms/input/a/b"),
                folder: resolve("#/web/atoms"),
                prefix: resolve("#/web/atoms/inputs"),
            };
        });

        expect(routes.home).toEqual({});
        expect(routes.slash).toEqual({});
        expect(routes.readme).toEqual({ name: "@papit/input" });
        expect(routes.view).toEqual({ name: "@papit/input", page: "showcase" });
        expect(routes.deep).toEqual({ unknown: "web/atoms/input/a/b" });
        expect(routes.folder).toEqual({ unknown: "web/atoms" });
        expect(routes.prefix).toEqual({ unknown: "web/atoms/inputs" });
    });
});

test.describe("@papit/showcase views", () => {
    test("a view route loads the package view through the router", async ({ page }) => {
        await page.goto('tests/showcase/#/web/atoms/input/showcase');
        await expect(page.getByTestId("routed-view")).toHaveText("input showcase view");
        await expect(page.locator("pap-showcase pap-router")).toBeVisible();
    });

    test("leaving a view hides the router", async ({ page }) => {
        await page.goto('tests/showcase/#/web/atoms/input/showcase');
        await expect(page.getByTestId("routed-view")).toBeVisible();

        await page.evaluate(() => { window.location.hash = "#/web/atoms/input"; });
        await expect(page.locator("pap-showcase pap-router")).toBeHidden();
        await expect(page.locator("pap-showcase main pap-markdown h1")).toHaveText("@papit/input");
    });

    test("an unknown page shows not found", async ({ page }) => {
        await page.goto('tests/showcase/#/web/atoms/input/nope');
        await expect(page.locator("pap-showcase [part=not-found]")).toContainText("web/atoms/input/nope");
    });
});

test.describe("@papit/showcase readme pages", () => {
    test("home renders the root README", async ({ page }) => {
        await expect(page.locator("pap-showcase main pap-markdown h1")).toHaveText("papit home");
    });

    test("an in-page README link keeps the route", async ({ page }) => {
        await page.locator("pap-showcase main pap-markdown").getByRole("link", { name: "lexer" }).click();
        expect(new URL(page.url()).hash).toBe("");
        await expect(page.locator("pap-showcase main pap-markdown h1")).toBeVisible();
    });

    test("a package page shows its meta and README", async ({ page }) => {
        await page.goto('tests/showcase/#/web/atoms/input');
        const section = page.locator("pap-showcase").getByRole("region", { name: "@papit/input" });
        await expect(section).toContainText("v1.0.0");
        await expect(section).toContainText("web-component");
        await expect(section.locator("pap-markdown")).toContainText("Text input readme.");
    });

    test("a package without README falls back to its description", async ({ page }) => {
        await page.goto('tests/showcase/#/runtime/lexer');
        const section = page.locator("pap-showcase").getByRole("region", { name: "@papit/lexer" });
        await expect(section.getByRole("heading", { level: 1 })).toHaveText("@papit/lexer");
        await expect(section).toContainText("lexer");
    });
});

test.describe("@papit/showcase pill", () => {
    test("focusing the toggle opens the package pages, a link navigates", async ({ page }) => {
        await page.goto('tests/showcase/#/web/atoms/input');
        const pill = page.locator("pap-showcase").getByRole("navigation", { name: "Site" });
        const pages = pill.getByRole("list");
        await pill.getByRole("button", { name: "input" }).focus();
        await expect(pages.getByRole("link")).toHaveText(["readme", "showcase", "translations"]);

        await pages.getByRole("link", { name: "translations" }).click();
        await expect(page).toHaveURL(/#\/web\/atoms\/input\/translations$/);
    });
});

test.describe("@papit/showcase translations", () => {
    test("shows a row per key and a column per language", async ({ page }) => {
        await page.goto('tests/showcase/#/web/atoms/input/translations');
        const table = page.locator("pap-showcase-translations").getByRole("table");
        await expect(table.getByRole("row")).toHaveCount(2);
        await expect(table).toContainText("input.clear");
        await expect(table).toContainText("Clear");
    });

    test("flatten and toCSV", async ({ page }) => {
        const result = await page.evaluate(() => ({
            flat: (window as any).flatten({ meta: { x: 1 }, a: { b: "c" }, d: 2 }),
            csv: (window as any).toCSV([["a", 'say "hi"'], ["b", "x,y"]]),
        }));
        expect(result.flat).toEqual({ "a.b": "c", d: "2" });
        expect(result.csv).toBe('"a","say ""hi"""\r\n"b","x,y"\r\n');
    });
});

test.describe("@papit/showcase docs", () => {
    test("docs get their own sidebar section and render as markdown", async ({ page }) => {
        const docs = page.locator("pap-showcase pap-treeview[part=docs]");
        await docs.getByRole("treeitem", { name: "guides" }).click();
        await docs.getByRole("link", { name: "start" }).click();

        await expect(page).toHaveURL(/#\/docs\/guides\/start$/);
        await expect(page.locator("pap-showcase main pap-markdown h1")).toHaveText("Getting started");
    });
});
