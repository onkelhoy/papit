import { expect, test } from "@playwright/test";

import { connect, host, join, log, logged, newApp, player, players } from "./helpers";

// real WebRTC between browser contexts, through a local signal server (playwright.config.ts starts it)
test.describe.configure({ mode: "parallel", timeout: 60_000 });
test.skip(({ browserName }) => browserName !== "chromium", "WebRTC between headless contexts is chromium only here");

test("host, list, join, message both ways", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    const { code } = await host(ada, { name: "Ada's game", public: true, max: 4 });
    const bob = await player(browser, app, "bob");

    // the lobby lists the game and its host
    await expect.poll(() => bob.evaluate(() => (window as any).net.listGames()), { timeout: 15_000 })
        .toEqual([expect.objectContaining({ code, name: "Ada's game", players: 1, max: 4, password: false, locked: false, public: true })]);
    await expect.poll(async () => (await bob.evaluate(() => (window as any).net.listPlayers())).find((p: any) => p.profile.name === "ada")?.game, { timeout: 15_000 })
        .toBe(code);

    const joined = await join(bob, code);
    expect(joined.ok).toBe(true);
    await logged(ada, { event: "join", detail: { player: { profile: { name: "bob" } } } });
    expect(await players(ada)).toEqual(["ada", "bob"]);
    expect(await players(bob)).toEqual(["ada", "bob"]);

    // the listing follows the player count
    await expect.poll(async () => (await ada.evaluate(() => (window as any).net.listGames()))[0]?.players, { timeout: 15_000 }).toBe(2);

    await bob.evaluate(() => (window as any).net.game.broadcast("move", { x: 1 }));
    await logged(ada, { event: "message", type: "move", data: { x: 1 }, from: joined.me });

    await ada.evaluate(id => (window as any).net.game.send(id, "hit", { hp: 3 }), joined.me);
    await logged(bob, { event: "message", type: "hit", data: { hp: 3 } });

    // to myself goes straight to my handlers
    await ada.evaluate(() => { const { game } = (window as any).net; game.send(game.me, "self", { ok: true }); });
    await logged(ada, { event: "message", type: "self", data: { ok: true } });

    // the game's own message types are off limits
    expect(await bob.evaluate(() => { try { (window as any).net.game.broadcast("game:hello", {}); return ""; } catch (error: any) { return error.name; } })).toBe("RangeError");
});

test("private games aren't listed, a password is checked", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    const { code } = await host(ada, { name: "secret", password: "pw" });
    const bob = await player(browser, app, "bob");

    await bob.waitForTimeout(1500);
    expect(await bob.evaluate(() => (window as any).net.listGames())).toEqual([]);

    expect(await join(bob, code)).toMatchObject({ ok: false, reason: "password" });
    expect(await join(bob, code, { password: "nope" })).toMatchObject({ ok: false, reason: "password" });
    expect(await join(bob, code, { password: "pw" })).toMatchObject({ ok: true });
});

test("full and locked games say no, kicked players stay out", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    const { code } = await host(ada, { name: "small", max: 2 });
    const bob = await player(browser, app, "bob");
    const cid = await player(browser, app, "cid");

    expect(await join(bob, code)).toMatchObject({ ok: true });
    expect(await join(cid, code)).toMatchObject({ ok: false, reason: "full" });

    await ada.evaluate(() => (window as any).net.game.update({ max: 3 }));
    await ada.evaluate(() => (window as any).net.game.lock());
    await logged(bob, { event: "update", detail: { locked: true, max: 3 } });
    expect(await join(cid, code)).toMatchObject({ ok: false, reason: "locked" });

    await ada.evaluate(() => (window as any).net.game.lock(false));
    expect(await join(cid, code)).toMatchObject({ ok: true });

    const cidId = await cid.evaluate(() => (window as any).net.game.me);
    await ada.evaluate(id => (window as any).net.game.kick(id), cidId);
    await logged(cid, { event: "end", detail: "kicked" });
    await logged(bob, { event: "leave", detail: { reason: "kicked" } });
    expect(await join(cid, code)).toMatchObject({ ok: false, reason: "kicked" });
});

test("leaving: a guest's goodbye, the host closing it for all", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    const { code } = await host(ada, { name: "bye" });
    const bob = await player(browser, app, "bob");
    const cid = await player(browser, app, "cid");
    expect(await join(bob, code)).toMatchObject({ ok: true });
    expect(await join(cid, code)).toMatchObject({ ok: true });

    await bob.evaluate(() => (window as any).net.leaveGame());
    await logged(ada, { event: "leave", detail: { reason: "left", player: { profile: { name: "bob" } } } });
    await logged(cid, { event: "leave", detail: { reason: "left" } });
    expect(await bob.evaluate(() => (window as any).net.game)).toBeNull();

    await ada.evaluate(() => (window as any).net.leaveGame());
    await logged(cid, { event: "end", detail: "host-left" });
});

test("a guest's reload gets its place back", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    const { code } = await host(ada, { name: "reload" });
    const bob = await player(browser, app, "bob");
    const first = await join(bob, code);
    expect(first.ok).toBe(true);

    await bob.reload();
    await bob.waitForFunction(() => document.body.dataset.ready === "true");
    await connect(bob, { app, name: "bob", lobby: true });
    expect(await bob.evaluate(() => (window as any).net.last?.code)).toBe(code);
    await bob.evaluate(() => (window as any).net.resume());

    await logged(ada, { event: "join", detail: { player: { profile: { name: "bob" } } } });
    expect(await players(ada)).toEqual(["ada", "bob"]);
    // a reload says no goodbye: the host saw a drop, not a leave
    expect((await log(ada)).some(entry => entry.event === "leave" && entry.detail.reason === "left")).toBe(false);
});

test("single: a host's reload, the next in line holds the game and hands it back", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    const { code } = await host(ada, { name: "reload", password: "pw" });
    const bob = await player(browser, app, "bob");
    expect(await join(bob, code, { password: "pw" })).toMatchObject({ ok: true });

    await ada.reload();
    await ada.waitForFunction(() => document.body.dataset.ready === "true");
    // bob steps in
    await logged(bob, { event: "host" });
    expect(await bob.evaluate(() => (window as any).net.game.isHost)).toBe(true);

    await connect(ada, { app, name: "ada", lobby: true });
    const resumed = await ada.evaluate(async () => {
        const w = window as any;
        const game = w.watch(await w.net.resume());
        return { code: game.code, isHost: game.isHost, me: game.me };
    });
    expect(resumed).toMatchObject({ code, isHost: true });

    // handed back
    await expect.poll(() => bob.evaluate(() => (window as any).net.game.host)).toBe(resumed.me);
    expect(await bob.evaluate(() => (window as any).net.game.isHost)).toBe(false);
    expect(await players(ada)).toEqual(["ada", "bob"]);
    await bob.evaluate(() => (window as any).net.game.broadcast("still", { here: true }));
    await logged(ada, { event: "message", type: "still" });
});

test("shared: the host leaves, the next in line hosts and lets newcomers in", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    const { code } = await host(ada, { name: "shared", ownership: "shared" });
    const bob = await player(browser, app, "bob");
    const cid = await player(browser, app, "cid");
    const b = await join(bob, code);
    expect(await join(cid, code)).toMatchObject({ ok: true });

    await ada.evaluate(() => (window as any).net.leaveGame());
    await expect.poll(() => cid.evaluate(() => (window as any).net.game?.host)).toBe(b.me);
    expect(await bob.evaluate(() => (window as any).net.game.isHost)).toBe(true);
    expect(await players(cid)).toEqual(["bob", "cid"]);

    const dan = await player(browser, app, "dan");
    expect(await join(dan, code)).toMatchObject({ ok: true });
    expect(await players(dan)).toEqual(["bob", "cid", "dan"]);
});

test("lobby: false still joins by code, but lists nothing", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada", false);
    const { code } = await host(ada, { name: "quiet", public: true });
    const bob = await player(browser, app, "bob", false);

    expect(await bob.evaluate(() => (window as any).net.listGames().then(() => "", (error: any) => error.message))).toContain("lobby: true");
    expect(await join(bob, code)).toMatchObject({ ok: true });
});

test("resume: nothing older than timing.resume, and cancel gives up", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    const remember = (age: number) => ada.evaluate(({ app, age }) => sessionStorage.setItem(`${app}.game`, JSON.stringify({ code: "K7QF2M", role: "guest", token: "t", time: Date.now() - age })), { app, age });

    await remember(6 * 60_000);
    expect(await ada.evaluate(() => (window as any).net.resume())).toBeNull();

    await remember(0);
    const result = await ada.evaluate(async () => {
        const { net } = window as any;
        const trying = net.resume().then(() => "joined", (error: any) => error.reason);
        await new Promise(resolve => setTimeout(resolve, 300));
        const during = net.reconnecting;
        net.cancel();
        return { during, reason: await trying, after: net.reconnecting, last: net.last };
    });
    expect(result).toEqual({ during: true, reason: "left", after: false, last: null });
});

test("an unknown code is not-found", async ({ browser }) => {
    const app = newApp();
    const ada = await player(browser, app, "ada");
    expect(await join(ada, "K7QF2M")).toMatchObject({ ok: false, reason: "not-found" });
    expect(await join(ada, "nope")).toMatchObject({ ok: false, reason: "not-found" });
});
