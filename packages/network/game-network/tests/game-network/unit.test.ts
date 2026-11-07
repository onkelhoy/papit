import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
    await page.goto("tests/game-network/");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
});

test.describe("codes and links", () => {
    test("a new code is 6 easy letters and survives cleaning", async ({ page }) => {
        const result = await page.evaluate(() => {
            const { newCode, cleanCode } = (window as any).network;
            const codes = Array.from({ length: 200 }, () => newCode());
            return { lengths: [...new Set(codes.map((c: string) => c.length))], clean: codes.every((c: string) => cleanCode(c) === c), unclear: codes.some((c: string) => /[01OIL]/.test(c)) };
        });
        expect(result).toEqual({ lengths: [6], clean: true, unclear: false });
    });

    test("cleanCode tidies typed codes and refuses others", async ({ page }) => {
        const result = await page.evaluate(() => {
            const { cleanCode } = (window as any).network;
            return [cleanCode("k7qf-2m"), cleanCode(" K7 QF 2M "), cleanCode("K7QF2"), cleanCode("K7QF2O"), cleanCode(null)];
        });
        expect(result).toEqual(["K7QF2M", "K7QF2M", "", "", ""]);
    });

    test("invite links round trip and keep the rest of the address", async ({ page }) => {
        const result = await page.evaluate(() => {
            const { inviteLink, parseInvite, withoutInvite } = (window as any).network;
            const link = inviteLink("K7QF2M", "https://example.com/play?signal=ws://x#top");
            const url = new URL(link);
            return { code: parseInvite(url.search), signal: url.searchParams.get("signal"), hash: url.hash, without: withoutInvite(link) };
        });
        expect(result).toEqual({ code: "K7QF2M", signal: "ws://x", hash: "", without: "https://example.com/play?signal=ws%3A%2F%2Fx" });
    });

    test("GameNetwork.inviteCode reads the page address", async ({ page }) => {
        await page.goto("tests/game-network/?g=k7qf2m");
        await page.waitForFunction(() => document.body.dataset.ready === "true");
        expect(await page.evaluate(() => (window as any).network.GameNetwork.inviteCode())).toBe("K7QF2M");
    });
});

test.describe("settings", () => {
    test("resolve fills in defaults and derives the http side", async ({ page }) => {
        const config = await page.evaluate(() => {
            const { resolve, DEFAULT_TIMING } = (window as any).network;
            const config = resolve({ signal: "wss://signal.example.com/", app: "animals", timing: { joinGap: 1 } });
            return { ...config, storage: config.storage === sessionStorage, defaults: DEFAULT_TIMING };
        });
        expect(config.http).toBe("https://signal.example.com");
        expect(config.lobby).toBe(false);
        expect(config.meta).toEqual({ app: "animals", v: 1 });
        expect(config.storage).toBe(true);
        expect(config.timing.joinGap).toBe(1);
        expect(config.timing.hostWait).toBe(config.defaults.hostWait);
    });

    test("resolve refuses a missing app and a non-websocket url", async ({ page }) => {
        const errors = await page.evaluate(() => {
            const { resolve } = (window as any).network;
            const fails = (settings: unknown) => { try { resolve(settings); return ""; } catch (error: any) { return error.message; } };
            return [fails({ signal: "ws://x" }), fails({ signal: "https://x", app: "a" })];
        });
        expect(errors[0]).toContain("app");
        expect(errors[1]).toContain("ws://");
    });

    test("storage: null turns memory off", async ({ page }) => {
        const storage = await page.evaluate(() => (window as any).network.resolve({ signal: "ws://x", app: "a", storage: null }).storage);
        expect(storage).toBeNull();
    });
});

test.describe("memory", () => {
    test("same code and role keep the token, anything else gets a new one", async ({ page }) => {
        const result = await page.evaluate(() => {
            const { Memory } = (window as any).network;
            sessionStorage.clear();
            const memory = new Memory(sessionStorage, "unit");
            const a = memory.save("K7QF2M", "guest").token;
            const b = memory.save("K7QF2M", "guest").token;
            const c = memory.save("K7QF2M", "host", { name: "x" }).token;
            const kept = memory.get();
            memory.clear();
            return { same: a === b, changed: b !== c, role: kept.role, options: kept.options, cleared: memory.get() };
        });
        expect(result).toEqual({ same: true, changed: true, role: "host", options: { name: "x" }, cleared: null });
    });

    test("broken or old storage reads as nothing", async ({ page }) => {
        const result = await page.evaluate(() => {
            const { Memory } = (window as any).network;
            const memory = new Memory(sessionStorage, "unit");
            sessionStorage.setItem("unit.game", "{not json");
            const broken = memory.get();
            sessionStorage.setItem("unit.game", JSON.stringify({ code: "K7QF2M", role: "guest", token: "t", time: Date.now() - 3 * 3600_000 }));
            const old = memory.get();
            return { broken, old, none: new Memory(null, "unit").get() };
        });
        expect(result).toEqual({ broken: null, old: null, none: null });
    });
});

