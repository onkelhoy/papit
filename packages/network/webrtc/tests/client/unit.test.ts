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

test.describe("merge", () => {
  test("two hosts merge: the smaller moves and the server keeps one network", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const big = await w.group(url, 2, {}, "big");
      const small = await w.group(url, 1, {}, "small");

      const merged = w.once(small.host, "merged");
      const network = await small.host.merge(big.host.serverId);
      await merged;
      const clients = [...big.clients, ...small.clients];
      await w.until(() => clients.every(c => c.members.length === 3));
      await w.settled(clients);

      const seen = {
        name: network.name,
        size: network.size,
        same: clients.every(c => c.network.id === big.network.id && c.host === big.host.id && c.members.length === 3),
        serverId: small.host.serverId === big.host.serverId,
        list: (await big.host.list()).map((n: any) => n.name),
      };
      for (const client of clients) client.close();
      return seen;
    }, url);

    expect(result).toEqual({ name: "big", size: 3, same: true, serverId: true, list: expect.arrayContaining(["big"]) });
    expect(result.list).not.toContain("small");
  });

  test("the asking host can be the one that stays", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const big = await w.group(url, 2, {}, "big");
      const small = await w.group(url, 1, {}, "small");

      const network = await big.host.merge(small.host.serverId);
      await w.until(() => small.host.members.length === 3);
      const seen = { name: network.name, host: small.host.host === big.host.id };
      big.host.close(); big.clients[1].close(); small.host.close();
      return seen;
    }, url);

    expect(result).toEqual({ name: "big", host: true });
  });

  test("a merge needs the host's consent, its password and the same topology", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const mine = await w.group(url, 1, {}, "mine");
      const closed = await w.group(url, 1, { acceptMerge: undefined }, "closed");
      const locked = await w.group(url, 1, {}, "locked", { password: "pw" });
      const other = await w.group(url, 1, { topology: "chord" }, "other");

      // spaced out: the server closes a socket that signals too fast
      const attempt = async (id: string, password?: string) => {
        await new Promise(resolve => setTimeout(resolve, 250));
        return mine.host.merge(id, password).then(() => "merged", (error: Error) => error.message);
      };
      const seen = [await attempt(closed.host.serverId), await attempt(locked.host.serverId, "nope"), await attempt(other.host.serverId), await attempt("nope")];
      const stayed = mine.host.members.length;
      for (const c of [mine, closed, locked, other]) c.host.close();
      return { seen, stayed };
    }, url);

    expect(result.seen.slice(0, 3)).toEqual(["rejected: not accepted", "rejected: wrong password", "rejected: different topology"]);
    expect(result.seen[3]).toContain("not-found");
    expect(result.stayed).toBe(1);
  });

  test("a locked network keeps its password for the group that moved in", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const locked = await w.group(url, 2, {}, "locked", { password: "pw" });
      const small = await w.group(url, 1, {}, "small");

      await small.host.merge(locked.host.serverId, "pw");
      const password = small.host.password;
      for (const c of [...locked.clients, ...small.clients]) c.close();
      return password;
    }, url);

    expect(result).toBe("pw");
  });

  test("only the hosts use the server, members move over peer links", async ({ page }) => {
    await page.evaluate(async (url) => {
      const w = window as any;
      // keepSocket: every member still has a socket it could use, and must not
      const options = { keepSocket: true };
      w.left = await w.group(url, 3, options, "left");
      w.right = await w.group(url, 2, options, "right");
    }, url);

    const hosts: string[] = await page.evaluate(() => {
      const w = window as any;
      return [w.left.host.id, w.right.host.id];
    });
    const sent = new Map<string, number>();
    for (const socket of socketserver.clients as Set<any>)
    {
      socket.on("message", () => sent.set(socket.id, (sent.get(socket.id) ?? 0) + 1));
    }

    const result = await page.evaluate(async () => {
      const w = window as any;
      const clients = [...w.left.clients, ...w.right.clients];
      await w.right.host.merge(w.left.host.serverId);
      await w.settled(clients);

      const got: string[] = [];
      for (const client of clients) client.addEventListener("message", (event: any) => got.push(client.id));
      w.right.clients[1].broadcast("hello");
      await w.until(() => got.length === 4);
      return { links: clients.map(c => c.links.length) };
    });
    const users = [...sent.keys()];

    await page.evaluate(() => {
      const w = window as any;
      for (const client of [...w.left.clients, ...w.right.clients]) client.close();
    });

    expect(result.links).toEqual([4, 4, 4, 4, 4]);
    expect(users.filter(id => !hosts.includes(id))).toEqual([]);
    expect(users.length).toBeGreaterThan(0);
  });

  test("chord: 5+5 settle on exactly what the topology wants, nobody is lost", async ({ page }) => {
    test.setTimeout(45_000);
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const options = { topology: "chord" };
      const left = await w.group(url, 5, options, "left");
      const right = await w.group(url, 5, options, "right");
      const clients = [...left.clients, ...right.clients];

      await right.host.merge(left.host.serverId);
      await w.until(() => clients.every(c => c.pace === null), 30_000);

      const got: string[] = [];
      for (const client of clients) client.addEventListener("message", () => got.push(client.id));
      clients[9].broadcast("hello");
      await w.until(() => got.length === 9);

      await w.until(() => clients.every(c => c.links.every((peer: string) => c.wanted(peer))));
      const seen = {
        members: clients.map(c => c.members.length),
        missing: clients.flatMap(c => c.router.desired()),
        split: clients.filter(c => c.router.split).length,
      };
      for (const client of clients) client.close();
      return seen;
    }, url);

    expect(result).toEqual({ members: Array(10).fill(10), missing: [], split: 0 });
  });

  test("chord opens predecessor and successor first", async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = window as any;
      const members = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const { stitch, neighbors } = w.chord;
      const view = { me: "a", host: "a", members, links: [] };
      return members.map(id => ({ count: stitch(view, id).length, within: stitch(view, id).every((p: string) => neighbors(view, id).includes(p)) }));
    });

    expect(result.every(r => r.count === 2 && r.within)).toBe(true);
  });

  test("both hosts ask at once: one merge happens", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const left = await w.group(url, 1, {}, "left");
      const right = await w.group(url, 1, {}, "right");

      const outcomes = await Promise.allSettled([left.host.merge(right.host.serverId), right.host.merge(left.host.serverId)]);
      await w.until(() => left.host.members.length === 2 && right.host.members.length === 2);
      await w.settled([left.host, right.host]);
      const seen = {
        outcomes: outcomes.map(o => o.status).sort(),
        members: [left.host.members.length, right.host.members.length],
        same: left.host.network.id === right.host.network.id,
      };
      left.host.close();
      right.host.close();
      return seen;
    }, url);

    expect(result).toEqual({ outcomes: ["fulfilled", "rejected"], members: [2, 2], same: true });
  });

  test("a host without a socket reopens one to merge", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const left = await w.group(url, 2, { keepSocket: false }, "left");
      await w.until(() => left.host.dropped);
      const right = await w.group(url, 1, {}, "right");

      const network = await left.host.merge(right.host.serverId);
      const clients = [...left.clients, ...right.clients];
      await w.until(() => clients.every(c => c.members.length === 3));
      await w.settled(clients);
      const seen = { name: network.name, members: clients.map(c => c.members.length), reassigned: left.host.router.socketId !== left.host.id };
      for (const client of clients) client.close();
      return seen;
    }, url);

    expect(result).toEqual({ name: "left", members: [3, 3, 3], reassigned: true });
  });

  test("a network mid-merge turns newcomers away", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const left = await w.group(url, 1, {}, "left");
      const guest = new w.Client({ url, wake: false });
      left.host.startMerge();
      const reason = await guest.join(left.host.serverId).then(() => "joined", (error: Error) => error.message);
      guest.close();
      left.host.close();
      return reason;
    }, url);

    expect(result).toBe("rejected: merging");
  });

  test("closing mid-merge rejects and leaves nothing behind", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const left = await w.group(url, 1, {}, "left");
      const right = await w.group(url, 1, {}, "right");

      const merging = left.host.merge(right.host.serverId).then(() => "merged", () => "rejected");
      await left.host.ready;
      left.host.close();
      const outcome = await merging;
      await w.until(() => right.host.merging === null && right.host.router.bridge === null);
      const seen = { outcome, merging: left.host.merging, pending: left.host.pending.size, members: right.host.members.length };
      right.host.close();
      return seen;
    }, url);

    expect(result).toEqual({ outcome: "rejected", merging: null, pending: 0, members: 1 });
  });

  // nobody opens a link, so the host link is all that joins the two groups when a host dies
  const stalled = async (page: any, dying: "stay" | "move") => page.evaluate(async ({ url, dying }: any) => {
    const w = window as any;
    const stay = await w.group(url, 3, {}, "stay");
    const move = await w.group(url, 2, {}, "move");
    const clients = [...stay.clients, ...move.clients];
    for (const client of clients) client.paceLinks = () => { };

    await move.host.merge(stay.host.serverId);
    await w.until(() => clients.every(c => c.members.length === 5));
    const dead = dying === "stay" ? stay.host : move.host;
    dead.close();

    const staying = stay.clients.filter((c: any) => c !== dead);
    const moving = move.clients.filter((c: any) => c !== dead);
    await w.until(() => staying.every((c: any) => c.members.length === stay.clients.length - (dying === "stay" ? 1 : 0)) && moving.every((c: any) => c.members.length === move.clients.length - (dying === "move" ? 1 : 0)));
    await w.until(() => [...staying, ...moving].every((c: any) => c.host) && moving[0].host === moving.at(-1).host);
    const moved = moving.find((c: any) => c.host === c.id);
    await w.until(() => moved.serverId && moved.socket?.open !== false);

    const seen = {
      staying: staying.map((c: any) => c.members.length),
      moving: moving.map((c: any) => c.members.length),
      hosted: moved === move.host,
      name: moved.network.name,
    };
    for (const client of clients) client.close();
    return seen;
  }, { url, dying });

  test("the staying host dies before any link crossed: the moved group carries on under its host", async ({ page }) => {
    expect(await stalled(page, "stay")).toEqual({ staying: [2, 2], moving: [2, 2], hosted: true, name: "stay" });
  });

  test("the moving host dies before any link crossed: both groups carry on apart", async ({ page }) => {
    expect(await stalled(page, "move")).toEqual({ staying: [3, 3, 3], moving: [1], hosted: false, name: "stay" });
  });

  test("a host dying later changes nothing: the links carry on", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const stay = await w.group(url, 3, {}, "stay");
      const move = await w.group(url, 2, {}, "move");
      const clients = [...stay.clients, ...move.clients];

      await move.host.merge(stay.host.serverId);
      await w.settled(clients);
      stay.host.close();

      const rest = clients.filter(c => c !== stay.host);
      await w.until(() => rest.every(c => c.members.length === 4));
      await w.settled(rest);
      const seen = rest.map(c => c.members.length);
      for (const client of rest) client.close();
      return seen;
    }, url);

    expect(result).toEqual([4, 4, 4, 4]);
  });

  test("a room keeps working through a merge", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const left = await w.group(url, 2, {}, "left");
      const right = await w.group(url, 1, {}, "right");
      const [a, b] = left.clients;

      const room = await a.room({ name: "call" });
      const guest = await b.joinRoom(room.network.id, room.host);
      await w.until(() => room.links.length === 1 && guest.links.length === 1);

      await right.host.merge(left.host.serverId);
      await w.settled([...left.clients, ...right.clients]);

      const got = w.once(room, "message");
      guest.send(a.id, "hello", { text: "hej" });
      const message = await got;
      const late = await right.host.room({ name: "later" });
      const third = await a.joinRoom(late.network.id, late.host);
      await w.until(() => late.links.length === 1 && third.links.length === 1);
      const seen = { text: message.payload.text, room: room.members.length, later: late.members.length };
      for (const client of [...left.clients, ...right.clients]) client.close();
      return seen;
    }, url);

    expect(result).toEqual({ text: "hej", room: 2, later: 2 });
  });
});

test.describe("ring", () => {
  test("links the peers on either side, and the short way round", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { ring } = window as any;
      const order = ["c", "a", "d", "b", "e", "f"];
      const view = { me: "c", host: "c", members: [...order].sort(), order, links: ["a", "f"] };
      const meta = (receiver: string, hops: string[] = ["c"]) => ({ receiver, hops });
      return {
        neighbors: ring.neighbors(view, "c"),
        stitch: ring.stitch(view, "c"),
        ahead: ring.route(view, meta("d")),
        behind: ring.route(view, meta("e")),
        back: ring.route({ ...view, links: ["f"] }, meta("d")),
        broadcast: ring.route(view, meta("*", ["c", "a"])),
        ttl: ring.ttl(view),
        pair: ring.neighbors({ ...view, members: ["a", "b"], order: ["a", "b"] }, "a"),
        alone: ring.neighbors({ ...view, members: ["a"], order: ["a"] }, "a"),
      };
    });

    expect(result).toEqual({
      neighbors: ["f", "a"], stitch: ["f", "a"], ahead: ["a"], behind: ["f"], back: ["f"],
      broadcast: ["f"], ttl: 5, pair: ["b"], alone: [],
    });
  });

  test("a broadcast crosses a ring of 40, past the default ttl", async ({ page }) => {
    test.setTimeout(60_000);
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { clients } = await w.group(url, 40, { topology: "ring" });
      await w.until(() => clients.every((c: any) => c.links.length === 2));

      const got: string[] = [];
      for (const client of clients) client.addEventListener("message", () => got.push(client.id));
      clients[0].broadcast("hello");
      await w.until(() => got.length === 39);

      const seen = { got: new Set(got).size };
      for (const client of clients) client.close();
      return seen;
    }, url);

    expect(result).toEqual({ got: 39 });
  });

  test("merging two rings moves only the two seams", async ({ page }) => {
    test.setTimeout(45_000);
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const options = { topology: "ring" };
      const left = await w.group(url, 4, options, "left");
      const right = await w.group(url, 3, options, "right");
      const clients = [...left.clients, ...right.clients];
      const pairs = () => new Set(clients.flatMap(c => c.links.map((peer: string) => [c.id, peer].sort().join("|"))));

      await w.until(() => clients.every(c => c.links.length === 2));
      const before = pairs();
      await right.host.merge(left.host.serverId);
      await w.until(() => clients.every(c => c.pace === null), 30_000);
      await w.until(() => clients.every(c => c.links.length === 2));
      const after = pairs();

      const got: string[] = [];
      for (const client of clients) client.addEventListener("message", () => got.push(client.id));
      clients[6].broadcast("hello");
      await w.until(() => got.length === 6);

      const seen = {
        opened: [...after].filter(pair => !before.has(pair)).length,
        closed: [...before].filter(pair => !after.has(pair)).length,
        members: clients.map(c => c.members.length),
      };
      for (const client of clients) client.close();
      return seen;
    }, url);

    expect(result).toEqual({ opened: 2, closed: 2, members: Array(7).fill(7) });
  });

  test("a newcomer closes the old seam: nobody collects links", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { clients } = await w.group(url, 5, { topology: "ring" });
      await w.until(() => clients.every((c: any) => c.links.length === 2));
      const members = clients.map((c: any) => c.members.length);
      for (const client of clients) client.close();
      return members;
    }, url);

    expect(result).toEqual([5, 5, 5, 5, 5]);
  });
});

test.describe("joining", () => {
  test("members joining right behind each other link up without waiting out a timeout", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const clients = Array.from({ length: 5 }, () => new w.Client({ url, wake: false, topology: "chord" }));
      await Promise.all(clients.map(c => c.ready));
      const network = await clients[0].create({ name: "test" });
      for (const client of clients.slice(1)) await client.join(network.id);

      const linked = await w.settled(clients, 5_000).then(() => true, () => false);
      for (const client of clients) client.close();
      return linked;
    }, url);

    expect(result).toBe(true);
  });

  test("a locked network can't be joined around the server's password check", async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const w = window as any;
      const { host, network } = await w.group(url, 1, {}, "locked", { password: "pw" });
      const guest = new w.Client({ url, wake: false });
      await guest.ready;

      const join = () => w.Message.Create({ type: "network.join", sender: guest.id, receiver: host.id, network: network.id }, {});
      guest.router.send(join(), { preferServer: true });
      const inner = join();
      guest.router.send(guest.router.wrap(inner, inner.toBinary(true), host.id), { preferServer: true });
      await new Promise(resolve => setTimeout(resolve, 300));

      const members = host.members.length;
      guest.close();
      host.close();
      return members;
    }, url);

    expect(result).toBe(1);
  });
});
