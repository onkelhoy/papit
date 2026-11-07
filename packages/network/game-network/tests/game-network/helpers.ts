import { expect, type Browser, type Page } from "@playwright/test";

export const SIGNAL = "ws://localhost:3599";

/** Short waits, so the failure paths finish in seconds. */
export const FAST = {
    retryMin: 500,
    publish: 500,
    expire: 4000,
    answer: 1500,
    joinGap: 300,
    hostWait: 15_000,
    reconnect: 15_000,
    unknownFor: 2500,
    welcome: 4000,
};

/** A lobby of its own for each test, so tests running side by side don't see each other. */
export const newApp = () => `test-${Math.random().toString(36).slice(2, 10)}`;

/** One player: its own browser context (own storage), with `window.net` in the lobby, and an event log. */
export async function player(browser: Browser, app: string, name: string, lobby = true): Promise<Page> {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("console", message => {
        if (message.type() === "error") console.log(`[${name}]`, message.text());
    });
    await page.goto("tests/game-network/");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await connect(page, { app, name, lobby });
    return page;
}

export async function connect(page: Page, { app, name, lobby }: { app: string; name: string; lobby: boolean }) {
    await page.evaluate(async ({ app, name, lobby, signal, timing, watch }) => {
        eval(watch);
        const { GameNetwork } = (window as any).network;
        const w = window as any;
        w.log = [];
        w.net = new GameNetwork({ signal, app, lobby, profile: { name }, timing });
        await w.net.ready;
    }, { app, name, lobby, signal: SIGNAL, timing: FAST, watch: WATCH });
}

/** Wires a game's events and messages into `window.log`. */
export const WATCH = `
    window.watch = game => {
        for (const event of ["join", "leave", "update", "host", "reconnecting", "reconnected", "end"])
            game.on(event, detail => window.log.push({ event, detail }));
        game.onMessage("*", (data, from, type) => window.log.push({ event: "message", type, data, from }));
        return game;
    };
`;

export async function host(page: Page, options: Record<string, unknown>) {
    return page.evaluate(async ({ options, watch }) => {
        eval(watch);
        const w = window as any;
        const game = w.watch(await w.net.createGame(options));
        return { code: game.code as string, me: game.me as string };
    }, { options, watch: WATCH });
}

/** Joins, resolving with the reason when it fails. */
export async function join(page: Page, code: string, options: Record<string, unknown> = {}) {
    return page.evaluate(async ({ code, options, watch }) => {
        eval(watch);
        const w = window as any;
        try
        {
            const game = w.watch(await w.net.joinGame(code, options));
            return { ok: true as const, me: game.me as string, reason: "" };
        }
        catch (error: any)
        {
            return { ok: false as const, me: "", reason: String(error?.reason ?? error) };
        }
    }, { code, options, watch: WATCH });
}

export const log = (page: Page) => page.evaluate(() => (window as any).log as any[]);

/** Waits until the page logged something like `match`. */
export async function logged(page: Page, match: Record<string, unknown>, timeout = 15_000) {
    await expect.poll(async () => (await log(page)).some(entry => like(entry, match)), { timeout }).toBe(true);
}

function like(value: any, match: any): boolean {
    if (match === null || typeof match !== "object") return value === match;
    return value != null && Object.entries(match).every(([key, want]) => like(value[key], want));
}

export const players = (page: Page) => page.evaluate(() => ((window as any).net.game?.players ?? []).map((p: any) => p.profile.name).sort());
