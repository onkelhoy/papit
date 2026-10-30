import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('tests/markdown/');
});

test.describe("@papit/markdown unit tests", () => {
  test("renders its own text, with the shared indentation removed", async ({ page }) => {
    const target = page.getByTestId("children");
    await expect(target.locator("h1")).toHaveText("Hello World");
    await expect(target.locator("h1")).toHaveAttribute("id", "hello-world");
    await expect(target.locator("p strong")).toHaveText("bold");
    await expect(target.locator("p code")).toHaveText("code");
    await expect(target.locator("pre code.language-js")).toHaveText("const a = 1;");
  });

  test("re-renders when its own text changes", async ({ page }) => {
    const target = page.getByTestId("children");
    await page.evaluate(() => {
      document.querySelector("[data-testid='children']")!.textContent = "## Changed";
    });
    await expect(target.locator("h2")).toHaveText("Changed");
    await expect(target.locator("h1")).toHaveCount(0);
  });

  test("content wins over the element's text and follows changes", async ({ page }) => {
    const target = page.getByTestId("content");
    await page.evaluate(() => {
      document.querySelector<any>("[data-testid='content']").content = "- a\n- b";
    });
    await expect(target.locator("ul > li")).toHaveText(["a", "b"]);
    await expect(target.locator("li p")).toHaveCount(0);

    await page.evaluate(() => {
      document.querySelector<any>("[data-testid='content']").content = "1. x";
    });
    await expect(target.locator("ol > li")).toHaveText(["x"]);
    await expect(target.locator("ul")).toHaveCount(0);
  });

  test("fetches src, fires load and resolves relative URLs against it", async ({ page }) => {
    const target = page.getByTestId("empty");
    const loaded = page.evaluate(() => new Promise<boolean>(resolve => {
      const element = document.querySelector<any>("[data-testid='empty']");
      element.addEventListener("load", () => resolve(true));
      element.src = "public/sample.md";
    }));
    expect(await loaded).toBe(true);

    await expect(target.locator("h1")).toHaveText("Sample");
    const base = new URL("public/", page.url()).href;
    await expect(target.locator("img")).toHaveAttribute("src", base + "images/logo.png");
    await expect(target.locator("a")).toHaveAttribute("href", new URL("../other.md", base).href);
  });

  test("fires error when src can't be fetched", async ({ page }) => {
    const failed = await page.evaluate(() => new Promise<boolean>(resolve => {
      const element = document.querySelector<any>("[data-testid='empty']");
      element.addEventListener("error", () => resolve(true));
      element.src = "public/missing.md";
    }));
    expect(failed).toBe(true);
  });

  test("keeps raw HTML as text and drops unsafe links", async ({ page }) => {
    const target = page.getByTestId("empty");
    await page.evaluate(() => {
      document.querySelector<any>("[data-testid='empty']").content = '<img src=x onerror="window.HACKED=1"> [x](javascript:alert(1)) [ok](https://example.com)';
    });
    await expect(target.locator("p")).toContainText("<img src=x");
    await expect(target.locator("img")).toHaveCount(0);
    await expect(target.locator("a")).toHaveCount(1);
    await expect(target.locator("a")).toHaveAttribute("href", "https://example.com");
    await expect(target.locator("a")).toHaveAttribute("rel", "noopener noreferrer");
    expect(await page.evaluate(() => (window as any).HACKED)).toBeUndefined();
  });

  test("renders tables, task lists, quotes and rules", async ({ page }) => {
    const target = page.getByTestId("empty");
    await page.evaluate(() => {
      document.querySelector<any>("[data-testid='empty']").content = "| a | b |\n|--|--:|\n| 1 | 2 |\n\n- [x] done\n\n> quote\n\n---";
    });
    await expect(target.locator("th")).toHaveText(["a", "b"]);
    await expect(target.locator("td").nth(1)).toHaveCSS("text-align", "right");
    await expect(target.locator("li.task input[type='checkbox']")).toBeChecked();
    await expect(target.locator("blockquote")).toHaveText("quote");
    await expect(target.locator("hr")).toHaveCount(1);
  });
});
