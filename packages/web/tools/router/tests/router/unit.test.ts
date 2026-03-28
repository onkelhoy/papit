import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/router/');
});

async function clickmainbutton(page: Page, testid: string) {
    const router = page.getByTestId("target");
    await expect(router).toBeAttached();
    const eventPromise = router.evaluate(element => {
        return new Promise<void>((resolveEvent) => {
            const listener = () => {
                (element as HTMLElement).removeEventListener("window-load", listener);
                resolveEvent();
            }

            (element as HTMLElement).addEventListener("window-load", listener);
        });
    });
    await page.getByTestId(testid).click();
    await eventPromise;
}

test.describe("router - basic unit tests", () => {
    test('available in DOM', async ({ page }) => {

        // Interact with your component and make assertions
        const component = await page.$('pap-router');
        expect(component).not.toBeNull();
    });

    test("main.js window load only once", async ({ page }) => {
        await clickmainbutton(page, "button-a");

        const loads = page.getByTestId("loads");
        expect(loads).toHaveText("1");
    })
});

test.describe("router - configuration", () => {

    test("update-url: true", async ({ page }) => {
        const initialURL = page.url();

        const router = await page.getByTestId("target");
        await router.evaluate(element => element.setAttribute("update-url", "true"));

        expect(await router.evaluate((element: any) => element.updateurl)).toBeTruthy();

        // wait so router can initiate
        await page.waitForTimeout(2000);

        const url = page.url();

        expect(url).not.toBe(initialURL);
    });
    test("update-url: false", async ({ page }) => {
        const initialURL = page.url();

        const router = page.getByTestId("target");
        await router.evaluate(element => element.setAttribute("update-url", "false"));

        expect(await router.evaluate((element: any) => element.updateurl)).toBeFalsy();

        // wait so router can initiate
        await page.waitForTimeout(2000);

        const url = page.url();

        expect(url).toBe(initialURL);
    });

    test("trailing slash: true", async ({ page }) => {
        const router = await page.getByTestId("target");
        await router.evaluate(element => element.setAttribute("trailing-slash", "true"));

        // wait so router can initiate
        await page.waitForTimeout(2000);

        const url = page.url();

        expect(url.endsWith("/router/#/")).toBeTruthy();
    });
    test("trailing slash: false", async ({ page }) => {
        const router = await page.getByTestId("target");
        await router.evaluate(element => element.setAttribute("trailing-slash", "false"));

        // wait so router can initiate
        await page.waitForTimeout(2000);

        const url = page.url();

        expect(url.endsWith("/router/#/")).toBeFalsy();
    });

    test("omitters", async ({ page }) => {
        const router = await page.getByTestId("target");
        await router.evaluate(element => {
            (element as any).omitters = ["script"]; // this should make ALL scripts unavailable 
        });

        await clickmainbutton(page, "button-a");

        const { scripts, styles } = await router.evaluate(element => {
            return {
                scripts: (element as any).head.querySelectorAll("script").length,
                styles: (element as any).head.querySelectorAll("style").length,
            }
        });

        expect(scripts).toBe(0);
        expect(styles).not.toBe(0);
    });
});

test.describe("router - mappings", () => {
    test("bash-based: false", async ({ page }) => {
        const router = await page.getByTestId("target");
        await router.evaluate(element => element.setAttribute("hash-based", "true"));

        await clickmainbutton(page, "button-hello-world");

        const url = page.url()

        // make sure a document was actully loaded
        const firstp = await page.getByTestId('first-p');
        expect(firstp).not.toBeNull();

        // make sure document A ws loaded
        expect(firstp).toHaveText("First Paragraph C updated");

        expect(url.endsWith("router/#/hello/world/")).toBeTruthy();
    });

    test("bash-based: true", async ({ page }) => {
        const router = await page.getByTestId("target");
        await router.evaluate(element => element.setAttribute("hash-based", "true"));

        await clickmainbutton(page, "button-hello-world");

        const url = page.url()

        // make sure a document was actully loaded
        const firstp = await page.getByTestId('first-p');
        expect(firstp).not.toBeNull();

        // make sure document A ws loaded
        expect(firstp).toHaveText("First Paragraph C updated");

        expect(url.endsWith("/router/#/hello/world/")).toBeTruthy();
    });

    test("param variable", async ({ page }) => {
        await clickmainbutton(page, "button-hello-foo-world-ABC");

        const router = await page.getByTestId("target");
        const foo = await router.evaluate(element => {
            return (element as any).params.foo;
        });

        expect(foo).toBe("ABC");

        const firstp = await page.getByTestId("first-p");
        expect(firstp).toHaveText("First Paragraph C updated")

        // make sure a document was actully loaded
        const param = await page.getByTestId('param');
        expect(param).not.toBeNull();

        // make sure document A ws loaded
        expect(param).toHaveText("ABC");
    });
})

test.describe("router - sources", () => {

    test("styles should have updated references", async ({ page }) => {
        await clickmainbutton(page, "button-a");

        const firstp = await page.getByTestId("first-p");

        expect(firstp).toHaveCSS("color", "rgb(199, 75, 75)");
    });

    test("javascript should have updated references", async ({ page }) => {
        await clickmainbutton(page, "button-a");

        const firstp = await page.getByTestId("first-p");
        expect(firstp).toHaveText("First Paragraph A updated")
    });

    test("switching document should flush the old sources", async ({ page }) => {
        await clickmainbutton(page, "button-a");

        const router = await page.getByTestId("target");
        const hashes = await router.evaluate(element => {
            const hashes: string[] = [];
            ((element as any).head as HTMLElement).querySelectorAll("[data-hash]").forEach(source => {
                const hash = source.getAttribute("data-hash");
                if (hash) hashes.push(hash);
            });

            return hashes;
        });

        await clickmainbutton(page, "button-c");

        const containsHashes = await router.evaluate((element, hashes) => {
            ((element as any).head as HTMLElement).querySelectorAll("[data-hash]").forEach(source => {
                const hash = source.getAttribute("data-hash");
                if (hash && hashes.includes(hash)) return true;
            });

            return false;
        }, hashes);

        expect(containsHashes).toBeFalsy();
    });

    test.skip("hash based should also recieve their sources", async ({ page }) => {
        await clickmainbutton(page, "button-a");

    });

    test("document load + refresh should also load sources", async ({ page }) => {
        const router = await page.getByTestId("target");
        // await router.evaluate(element => element.setAttribute("hash-based", "true"));

        await clickmainbutton(page, "button-hello-world");

        const url = page.url();

        const oldsources = await router.evaluate(element => {
            return {
                scripts: (element as any).head.querySelectorAll("script").length,
                styles: (element as any).head.querySelectorAll("style").length,
            }
        });

        expect(oldsources.scripts).toBeGreaterThan(1);
        expect(oldsources.styles).toBeGreaterThan(1);

        // just playwright omitting hash urls so we "reload" then go to url (to simulate a real reload..)
        await page.reload();
        // await page.goto(url);
        await page.waitForTimeout(2000); // allow router to setup 

        expect(url).toBe(page.url());

        const newsources = await router.evaluate(element => {
            return {
                scripts: (element as any).head.querySelectorAll("script").length,
                styles: (element as any).head.querySelectorAll("style").length,
            }
        });

        expect(newsources.scripts).toBeGreaterThan(1);
        expect(newsources.styles).toBeGreaterThan(1);
    });

    test.skip("trailing slashes should receive sources", async ({ page }) => {

        const router = await page.getByTestId("target");
        await router.evaluate(element => element.setAttribute("trailing-slash", "true"));

        await clickmainbutton(page, "button-hello-world");
    });
});

test.describe("router - SPA tests", () => {

    test("link click should not cause refresh", async ({ page }) => {
        let didPageReload = false;

        // Set up listener for the 'load' event before any actions
        page.on('load', () => {
            didPageReload = true;
        });

        await clickmainbutton(page, "button-a");

        // Ensure that no full page reload happened
        expect(didPageReload).toBe(false); // Page reload should NOT have occurred
    });

    test("URL should be updated on link click", async ({ page }) => {

        // Get initial page state
        const initialURL = page.url();

        await clickmainbutton(page, "button-a");

        // Ensure that the URL changed due to SPA routing
        const currentURL = page.url();
        expect(currentURL).not.toBe(initialURL);
    });

    test("link click should result in new page", async ({ page }) => {
        await page.waitForTimeout(2000); // allow router to setup 

        const initialContent = await page.content();
        await clickmainbutton(page, "button-a");

        // Ensure the content is different, meaning SPA routing updated the DOM
        const currentContent = await page.content();
        expect(currentContent).not.toBe(initialContent);

        // make sure a document was actully loaded
        const firstp = await page.getByTestId('first-p');
        expect(firstp).not.toBeNull();

        // make sure document A ws loaded
        expect(firstp).toHaveText("First Paragraph A updated");

    })
});

test.describe("router - hash-based setup", () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => {
            const router = document.querySelector("pap-router") as any;
            if (router)
            {
                router.hashbased = true;
            }
        });
    });

    test("initial page should include hashtag", async ({ page }) => {
        const initialURL = page.url();

        // wait for web component to load fully
        await page.waitForTimeout(2000);

        const navigatedURL = page.url();
        expect(navigatedURL).not.toBe(initialURL); // Check if the URL has changed

        expect(navigatedURL).toBe(initialURL + "/#/");
    });

    test("loading document A", async ({ page }) => {
        await clickmainbutton(page, "button-a");

        const navigatedURL = page.url();

        expect(navigatedURL.endsWith("/a/")).toBeTruthy();
    });

    test("refresh should render same page", async ({ page }) => {

        // Get the initial page content and URL
        const initialURL = page.url();

        await clickmainbutton(page, "button-a");

        const navigatedURL = page.url();
        expect(navigatedURL).not.toBe(initialURL); // Check if the URL has changed

        // Step 3: Refresh the page
        await page.reload(); // Refresh the page  

        // Wait for any SPA actions to complete, if necessary
        await page.waitForTimeout(2000); // Adjust based on your SPA behavior

        // Step 4: Verify that the content or state remains consistent after refresh
        const refreshedURL = page.url();

        // Verify that the URL is the same as after the SPA navigation
        expect(refreshedURL).toBe(navigatedURL);
    });
});

test.describe("router - proxies", () => {
    test("document.body should update propper case", async ({ page }) => {
        await clickmainbutton(page, "button-a");

        const header = await page.getByTestId("header");
        expect(header).toHaveText("Document A - Updated");
    })
    test.skip("window.onload should get triggered", async ({ page }) => { // this is already covered by load-resources JS
        await clickmainbutton(page, "button-a");

        const firstp = await page.getByTestId("first-p");
        expect(firstp).toHaveText("First Paragraph A updated")
    });
    test("window.addEventListener('load') should get triggered", async ({ page }) => {
        await clickmainbutton(page, "button-e");

        const firstp = await page.getByTestId("first-p");
        expect(firstp).toHaveText("First Paragraph E updated")
    });
    test('window.location proxy - param variable', async ({ page }) => {
        await clickmainbutton(page, "button-d");

        const parama = await page.getByTestId('param-a');
        expect(parama).not.toBeNull();
        expect(parama).toHaveText("abc");

        const paramb = await page.getByTestId('param-b');
        expect(paramb).not.toBeNull();
        expect(paramb).toHaveText("def");

        const paramc = await page.getByTestId('param-c');
        expect(paramc).not.toBeNull();
        expect(paramc).toHaveText("ghi");
    });
});

test.describe("router - fallbacks & dynamics", () => {

    test('fallback routes', async ({ page }) => {

        await clickmainbutton(page, "button-fallback");

        const url = page.url().split("#")[1];

        expect(url).toBe("/fallback/");

        // make sure a document was actully loaded
        const firstp = await page.getByTestId('first-p');
        expect(firstp).not.toBeNull();

        // make sure document A ws loaded
        expect(firstp).toHaveText("First Paragraph A updated");
    });
    test("fallback params", async ({ page }) => {
        await clickmainbutton(page, "button-showcase");

        const url = page.url().split("#")[1];

        expect(url).toBe("/showcase/atoms/button/showcase/");

        // making sure source was loaded
        const paragraph = await page.getByTestId('paragraph');
        expect(paragraph).not.toBeNull();
        expect(paragraph).toHaveText("showcase");
    });
    test("dynamic param", async ({ page }) => {
        await clickmainbutton(page, "icon-showcase");

        const url = page.url().split("#")[1];

        expect(url).toBe("/showcase/atoms/icon/icon/");

        // making sure source was loaded
        const paragraph = await page.getByTestId('paragraph');
        expect(paragraph).not.toBeNull();
        expect(paragraph).toHaveText("icon");
    })
});