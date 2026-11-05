import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import { SocketServer } from '@papit/signal-server';

let url: string;
let httpserver: http.Server;
let socketserver: SocketServer;

test.beforeAll(async () => {
  httpserver = http.createServer();
  socketserver = new SocketServer({ server: httpserver });
  await new Promise<void>(resolve => httpserver.listen(0, resolve));
  url = `ws://localhost:${(httpserver.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  socketserver.close();
  httpserver.closeAllConnections();
  await new Promise(resolve => httpserver.close(resolve));
});

test.beforeEach(async ({ page }) => {
  await page.goto('tests/core/');
  await page.waitForFunction(() => (window as any).ready === true);
});

/** Polls check() in real time. */
const waitFor = `async (check, ms = 10000) => {
  const end = Date.now() + ms;
  while (!check()) { if (Date.now() > end) throw new Error("timed out: " + check); await new Promise(r => setTimeout(r, 20)); }
}`;

test.describe("client", () => {
  test("three clients form a mesh over webrtc and non-anchors drop their socket", async ({ page }) => {
    const result = await page.evaluate(async ({ url, waitFor }) => {
      const w = window as any;
      const until = eval(waitFor);
      const [a, b, c] = [0, 1, 2].map(() => new w.core.Client({ url }));

      const lobby = await a.create({ name: "lobby", topology: "mesh" });
      const nb = await b.join(lobby.info.id);
      const nc = await c.join(lobby.info.id);
      await until(() => [lobby, nb, nc].every((n: any) => n.linked.size === 2));
      await until(() => !b.online && !c.online, 5000);

      const got: string[] = [];
      nc.on("message", (event: any) => got.push(event.detail.parse().text));
      nb.send(c.id, "chat", { text: "direct" });
      lobby.broadcast("chat", { text: "all" });
      await until(() => got.length === 2);

      const out = { ids: [a.id, b.id, c.id], online: [a.online, b.online, c.online], anchored: [lobby.anchored, nb.anchored, nc.anchored], got };
      [a, b, c].forEach((client: any) => client.close());
      return out;
    }, { url, waitFor });

    expect(new Set(result.ids).size).toBe(3);
    expect(result.online).toEqual([true, false, false]);
    expect(result.anchored).toEqual([true, false, false]);
    expect(result.got.sort()).toEqual(["all", "direct"]);
  });

  test("the server checks the password: a wrong one is refused, the right one joins", async ({ page }) => {
    const result = await page.evaluate(async ({ url, waitFor }) => {
      const w = window as any;
      const until = eval(waitFor);
      const a = new w.core.Client({ url });
      const b = new w.core.Client({ url });
      const lobby = await a.create({ name: "locked", topology: "mesh", password: "secret" });
      const wrong = await b.join(lobby.info.id, { password: "nope" }).then(() => "joined", (error: Error) => error.message);
      const none = await b.join(lobby.info.id).then(() => "joined", (error: Error) => error.message);
      const joined = await b.join(lobby.info.id, { password: "secret" });
      await until(() => joined.linked.size === 1);
      const linked = [...joined.linked];
      a.close(); b.close();
      return { wrong, none, linked };
    }, { url, waitFor });

    expect(result.wrong).toBe("wrong password");
    expect(result.none).toBe("wrong password");
    expect(result.linked).toHaveLength(1);
  });

  test("a locked network can't be joined around the server's password check", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const a = new w.core.Client({ url });
      const lobby = await a.create({ name: "locked", topology: "mesh", password: "pw" });

      // a bare socket sends network.join straight to the anchor instead of signal.join
      const socket = new w.SocketLink(url);
      await new Promise(resolve => socket.addEventListener("welcome", resolve, { once: true }));
      const errors: string[] = [];
      socket.addEventListener("message", (event: CustomEvent) => {
        const message = w.read(event.detail);
        if (message?.meta.type === "signal.error") errors.push(message.parse().code);
      });
      socket.send(w.Message.Create({ type: "network.join", sender: socket.me, receiver: a.id, network: lobby.info.id }, {}).toBinary(true));
      await new Promise(resolve => setTimeout(resolve, 300));

      const out = { errors, linked: lobby.linked.size };
      socket.close(); a.close();
      return out;
    }, url);

    expect(result.errors).toEqual(["forbidden"]);
    expect(result.linked).toBe(0);
  });

  test("the accept hook refuses, and an unknown id fails", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const a = new w.core.Client({ url });
      const b = new w.core.Client({ url });
      const lobby = await a.create({ name: "picky", topology: "mesh" }, { accept: (_peer: string, profile: any) => profile?.name === "ok" });
      const refused = await b.join(lobby.info.id, { profile: { name: "nope" } }).then(() => "joined", (error: Error) => error.message);
      const unknown = await b.join("no-such-network").then(() => "joined", (error: Error) => error.message);
      const joined = await b.join(lobby.info.id, { profile: { name: "ok" } }).then(() => "joined", (error: Error) => error.message);
      a.close(); b.close();
      return { refused, unknown, joined };
    }, url);

    expect(result.refused).toBe("rejected");
    expect(result.unknown).toBe("no such network");
    expect(result.joined).toBe("joined");
  });

  test("the media plan reaches joiners, opens its channels and follows an update", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "headless WebRTC data channels are only reliable in chromium");

    const result = await page.evaluate(async ({ url, waitFor }) => {
      const w = window as any;
      const until = eval(waitFor);
      const a = new w.core.Client({ url });
      const b = new w.core.Client({ url });
      const media = { channels: { chat: { ordered: true } } };
      const lobby = await a.create({ name: "call", topology: "mesh", media });
      const joined = await b.join(lobby.info.id);
      const plan = joined.media.plan;

      const chat = joined.media.channel("chat");
      await until(() => chat.peers.length === 1);
      const heard = new Promise(resolve => chat.addEventListener("message", (event: CustomEvent) => resolve(event.detail.data)));
      lobby.media.channel("chat").send(b.id, "hej");
      const text = await heard;

      const next = { channels: { chat: { ordered: true }, files: { ordered: false } } };
      await lobby.update({ media: next });
      await until(() => !!joined.media.plan.channels?.files);
      const updated = joined.media.plan;

      a.close(); b.close();
      return { plan, text, updated };
    }, { url, waitFor });

    expect(result.plan).toEqual({ channels: { chat: { ordered: true } } });
    expect(result.text).toBe("hej");
    expect(result.updated).toEqual({ channels: { chat: { ordered: true }, files: { ordered: false } } });
  });

  test("a peer without a socket re-anchors when the anchor dies, and answers joins as its peer id", async ({ page }) => {
    const result = await page.evaluate(async ({ url, waitFor }) => {
      const w = window as any;
      const until = eval(waitFor);
      const [a, b, c] = [0, 1, 2].map(() => new w.core.Client({ url }));

      const lobby = await a.create({ name: "lonely", topology: "mesh", beacon: 100 });
      const nb = await b.join(lobby.info.id);
      await until(() => !b.online, 5000);

      a.close();
      await until(() => nb.anchored, 5000);
      const socket = b.socket.me;

      const nc = await c.join(lobby.info.id);
      await until(() => nc.linked.size === 1);
      const out = { online: b.online, resumed: socket === b.id, linked: [...nc.linked] };
      b.close(); c.close();
      return { ...out, b: b.id };
    }, { url, waitFor });

    expect(result.online).toBe(true);
    expect(result.resumed).toBe(true);
    expect(result.linked).toEqual([result.b]);
  });

  test("an anchor whose socket reconnects with a new id still answers joins", async ({ page }) => {
    await page.evaluate(async ({ url, waitFor }) => {
      const w = window as any;
      const until = eval(waitFor);
      w.clients = [0, 1, 2].map(() => new w.core.Client({ url }));
      const [a, b] = w.clients;
      w.lobby = await a.create({ name: "pair", topology: "mesh", anchors: 2 });
      w.nb = await b.join(w.lobby.info.id);
      await until(() => w.nb.anchored);
    }, { url, waitFor });

    const peer = await page.evaluate(() => (window as any).clients[1].id);
    for (const client of socketserver.clients) if ((client as any).id === peer) client.terminate();
    await expect.poll(() => socketserver.aliases.get(peer)).toBeTruthy();

    const result = await page.evaluate(async ({ waitFor }) => {
      const w = window as any;
      const until = eval(waitFor);
      const [a, b, c] = w.clients;
      a.close();
      const nc = await c.join(w.lobby.info.id);
      await until(() => nc.linked.size === 1);
      const out = { linked: [...nc.linked], b: b.id };
      b.close(); c.close();
      return out;
    }, { waitFor });

    expect(result.linked).toEqual([result.b]);
  });

  test("a peer that dropped its socket joins and creates again under its peer id", async ({ page }) => {
    const result = await page.evaluate(async ({ url, waitFor }) => {
      const w = window as any;
      const until = eval(waitFor);
      const [a, b, c] = [0, 1, 2].map(() => new w.core.Client({ url }));
      const one = await a.create({ name: "one", topology: "mesh" });
      const two = await a.create({ name: "two", topology: "mesh" });
      await b.join(one.info.id);
      await until(() => !b.online, 5000);

      const joined = await b.join(two.info.id);
      await until(() => joined.linked.size === 1);
      const own = await b.create({ name: "three", topology: "mesh" });
      const nc = await c.join(own.info.id);
      await until(() => nc.linked.size === 1);

      const out = { joined: [...joined.linked], own: [...nc.linked], a: a.id, b: b.id };
      [a, b, c].forEach((client: any) => client.close());
      return out;
    }, { url, waitFor });

    expect(result.joined).toEqual([result.a]);
    expect(result.own).toEqual([result.b]);
  });
});
