import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/showcase/');
    await page.waitForFunction(() => !!document.querySelector("pap-showcase")?.data);
});

test.describe("@papit/showcase sidebar", () => {
    test("renders the manifest tree as a navigation tree", async ({ page }) => {
        const tree = page.locator("pap-showcase").getByRole("tree", { name: "Packages" });
        await expect(tree).toBeVisible();
        // folders start collapsed, so only the top level is exposed
        await expect(tree.getByRole("treeitem")).toHaveCount(2);
        await tree.getByRole("treeitem", { name: "web" }).click();
        await expect(tree.getByRole("treeitem", { name: "atoms" })).toBeVisible();
    });

    test("clicking a package sets the hash and resolves the route", async ({ page }) => {
        await page.locator("pap-showcase").getByRole("treeitem", { name: "runtime" }).click();
        await page.locator("pap-showcase").getByRole("link", { name: "lexer" }).click();

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
        await expect(page.locator("pap-showcase main h1")).toHaveText("@papit/input");
    });

    test("an unknown page shows not found", async ({ page }) => {
        await page.goto('tests/showcase/#/web/atoms/input/nope');
        await expect(page.locator("pap-showcase [part=not-found]")).toContainText("web/atoms/input/nope");
    });
});
