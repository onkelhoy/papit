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
  await page.goto('tests/client/');
  await page.waitForFunction(() => (window as any).ready === true);
});

test.describe("socket", () => {
  test("a message queued with the old id isn't sent after a reconnect", async ({ page }) => {
    const errors = await page.evaluate(async (url) => {
      const w = window as any;
      const link = new w.SocketLink(url);
      const errors: string[] = [];
      link.addEventListener("message", (event: CustomEvent) => {
        const message = w.Message.FromBinary(event.detail, false);
        if (message.meta.type === w.SignalType.Error) errors.push(message.parse().code);
      });

      const first = await w.once(link, "welcome");
      link.ws.close();
      await w.once(link, "disconnect");
      link.send(w.Message.Create({ type: w.SignalType.List, sender: first, receiver: "server" }, {}).toBinary(true));
      await w.once(link, "welcome");
      await new Promise(resolve => setTimeout(resolve, 100));
      link.close();
      return errors;
    }, url);

    expect(errors).toEqual([]);
  });
});

test.describe("handshake", () => {
  test("ice connected at the timeout: waits for the channel instead of failing", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { handshake, channel } = w.fakeHandshake("connected", 40);
      setTimeout(() => channel.dispatchEvent(new Event("open")), 60);
      return handshake.start().then(() => "open", (reason: string) => reason);
    });

    expect(result).toBe("open");
  });

  test("ice connected but the channel never opens: fails after the second round", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const start = performance.now();
      const reason = await w.fakeHandshake("connected", 40).handshake.start().catch((reason: string) => reason);
      return { reason, waited: performance.now() - start };
    });

    expect(result.reason).toBe("timeout");
    expect(result.waited).toBeGreaterThan(70);
  });

  test("ice not connected: fails at the first timeout", async ({ page }) => {
    const reason = await page.evaluate(() => (window as any).fakeHandshake("checking", 20).handshake.start().catch((reason: string) => reason));
    expect(reason).toBe("timeout");
  });
});

test.describe("link", () => {
  test("two clients link", async ({ page }) => {
    const members = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url);
      await w.until(() => a.links.length === 1 && b.links.length === 1);
      const members = a.members.length;
      a.close();
      b.close();
      return members;
    }, url);

    expect(members).toBe(2);
  });

  test("a link that failed to open is tried again", async ({ page }) => {
    const retried = await page.evaluate(async (url) => {
      const w = window as any;
      // the first offer gets lost, so the first attempt times out
      const lose = (client: any) => {
        const send = client.router.send.bind(client.router);
        client.router.send = (message: any, options: any) => {
          if (message.meta.type !== "handshake.offer" || w.lost) return send(message, options);
          w.lost = true;
          return true;
        };
      };
      const { a, b, log } = await w.pair(url, { linkTimeout: 200 }, (a: any, b: any) => { lose(a); lose(b); });
      await w.until(() => a.links.length === 1 && b.links.length === 1);
      a.close();
      b.close();
      return log.filter((line: string) => line.startsWith("retrying"));
    }, url);

    expect(retried).toHaveLength(1);
  });

  test("a member whose link dropped stays and the link comes back", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url);
      await w.until(() => a.links.length === 1 && b.links.length === 1);

      a.router.removeLink(b.id);
      await w.until(() => b.links.length === 0);
      const during = [a.members.length, b.members.length];
      await w.until(() => a.links.length === 1 && b.links.length === 1);
      const after = [a.members.length, b.members.length, b.host === a.id];
      a.close();
      b.close();
      return { during, after };
    }, url);

    expect(result.during).toEqual([2, 2]);
    expect(result.after).toEqual([2, 2, true]);
  });

  test("a member gone without a leave is dropped after the wait", async ({ page }) => {
    const members = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url, { linkTimeout: 100 });
      await w.until(() => a.links.length === 1 && b.links.length === 1);

      b.router.send = () => false;
      b.close();
      await w.until(() => a.links.length === 0);
      const during = a.members.length;
      await w.until(() => a.members.length === 1);
      a.close();
      return { during, after: a.members.length };
    }, url);

    expect(members).toEqual({ during: 2, after: 1 });
  });

  test("a new connection from a linked peer replaces its stale link", async ({ page }) => {
    const replaced = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b, log } = await w.pair(url, { keepSocket: true });
      await w.until(() => a.links.length === 1 && b.links.length === 1);

      // one side loses its end without the other noticing
      const [lost, other] = a.id < b.id ? [a, b] : [b, a];
      const stale = other.router.link(lost.id);
      lost.router.links.delete(other.id);
      lost.router.invalidate();
      lost.link(other.id);
      await w.until(() => other.router.link(lost.id) !== stale && other.links.length === 1 && lost.links.length === 1);
      a.close();
      b.close();
      return log.filter((line: string) => line.includes("replacing the old link")).length;
    }, url);

    expect(replaced).toBe(1);
  });
});

test.describe("server id", () => {
  test("after a new host registers, everyone reads the same new id and a newcomer gets it too", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b, network } = await w.pair(url);
      const c = new w.Client({ url, wake: false });
      await c.join(network.id);
      await w.until(() => b.links.length === 2 && c.links.length === 2);

      const before = b.serverId;
      const told = Promise.all([b, c].map(client => w.once(client, "server-id")));
      a.close();
      const [one, two] = await told;

      const d = new w.Client({ url, wake: false });
      await d.join(one);
      const seen = { before, one, two, b: b.serverId, c: c.serverId, d: d.serverId, own: [b.network.id, d.network.id] };
      for (const client of [b, c, d]) client.close();
      return { ...seen, id: network.id };
    }, url);

    expect(result.before).toBe(result.id);
    expect(result.one).not.toBe(result.id);
    expect(result.two).toBe(result.one);
    expect([result.b, result.c, result.d]).toEqual([result.one, result.one, result.one]);
    expect(result.own).toEqual([result.id, result.id]);
  });

  test("a failed register is retried by itself", async ({ page }) => {
    const changed = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b, network } = await w.pair(url, { keepSocket: true });
      await w.until(() => b.links.length === 1);

      const request = b.request.bind(b);
      let failed = false;
      b.request = (...args: any[]) => {
        if (failed) return request(...args);
        failed = true;
        return Promise.reject(new Error("no"));
      };
      a.close();
      const id = await w.once(b, "server-id");
      b.close();
      return id !== network.id;
    }, url);

    expect(changed).toBe(true);
  });

  test("only the host can register again", async ({ page }) => {
    const message = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url);
      const message = await b.reregister().catch((error: Error) => error.message);
      a.close();
      b.close();
      return message;
    }, url);

    expect(message).toBe("only the host can register the network");
  });
});

test.describe("rooms", () => {
  test("a room opens over the lobby, with its own connection and nothing on the server", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url);
      await w.until(() => a.links.length === 1 && b.links.length === 1);

      const room = await a.room({ name: "call" });
      const guest = await b.joinRoom(room.network.id, room.host);
      await w.until(() => room.links.length === 1 && guest.links.length === 1);

      const got = w.once(room, "message");
      guest.send(a.id, "hello", { text: "hej" });
      const message = await got;

      const seen = {
        id: room.network.id,
        text: message.payload.text,
        members: guest.members.length,
        socket: room.socket,
        own: room.router.link(b.id).connection !== a.router.link(b.id).connection,
      };
      a.close();
      b.close();
      return seen;
    }, url);

    expect(result).toMatchObject({ text: "hej", members: 2, socket: null, own: true });
    expect(socketserver.networks.has(result.id)).toBe(false);
  });

  test("works with no socket left anywhere", async ({ page }) => {
    const members = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url, { keepSocket: false });
      await w.until(() => a.links.length === 1 && b.links.length === 1 && !a.socket.open && !b.socket.open);

      const room = await a.room({ name: "call" });
      const guest = await b.joinRoom(room.network.id, room.host);
      await w.until(() => room.links.length === 1 && guest.links.length === 1);
      const members = room.members.length;
      a.close();
      b.close();
      return members;
    }, url);

    expect(members).toBe(2);
  });

  test("the host checks the password", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url);
      await w.until(() => a.links.length === 1 && b.links.length === 1);

      const room = await a.room({ name: "call", password: "secret" });
      const message = await b.joinRoom(room.network.id, room.host, "nope").catch((error: Error) => error.message);
      const guest = await b.joinRoom(room.network.id, room.host, "secret");
      const members = guest.members.length;
      a.close();
      b.close();
      return { message, members };
    }, url);

    expect(result).toEqual({ message: "rejected: wrong password", members: 2 });
  });

  test("a room outlives leaving the lobby and closes with the client", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url);
      await w.until(() => a.links.length === 1 && b.links.length === 1);

      const room = await a.room({ name: "call" });
      const guest = await b.joinRoom(room.network.id, room.host);
      await w.until(() => room.links.length === 1 && guest.links.length === 1);

      b.leave();
      await w.until(() => a.links.length === 0);
      const got = w.once(guest, "message");
      room.send(b.id, "still-here");
      const message = await got;

      b.close();
      a.close();
      return { type: message.type, status: guest.status };
    }, url);

    expect(result).toEqual({ type: "still-here", status: "closed" });
  });

  test("a room's host leaves: the next one takes over and lets a newcomer in", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b, network } = await w.pair(url);
      const c = new w.Client({ url, wake: false });
      await c.join(network.id);
      await w.until(() => b.links.length === 2 && c.links.length === 2);

      const room = await a.room({ name: "call" });
      const guest = await b.joinRoom(room.network.id, room.host);
      await w.until(() => room.links.length === 1);
      room.close();
      await w.until(() => guest.host === b.id);

      const late = await c.joinRoom(guest.network.id, guest.host);
      await w.until(() => guest.links.length === 1 && late.links.length === 1);
      const members = late.members.length;
      for (const client of [a, b, c]) client.close();
      return { members };
    }, url);

    expect(result.members).toBe(2);
  });

  test("a room rejects what needs the server", async ({ page }) => {
    const message = await page.evaluate(async (url) => {
      const w = window as any;
      const { a, b } = await w.pair(url);
      const room = await a.room({ name: "call" });
      const message = await room.list().catch((error: Error) => error.message);
      a.close();
      b.close();
      return message;
    }, url);

    expect(message).toContain("isn't on the server");
  });
});
