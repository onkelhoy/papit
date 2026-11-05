import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { once } from "node:events";

import WebSocket from "ws";
import { Message, SERVER, SignalType } from "@papit/peer-message";
import { SocketServer } from "@papit/signal-server";

class Client {
    constructor(socket) {
        this.socket = socket;
        this.queue = [];
        this.waiters = [];
        socket.on("message", (data) => {
            const message = Message.FromBinary(new Uint8Array(data), false);
            try { message.parse(); } catch { /* keep bytes */ }
            const index = this.waiters.findIndex(w => w.match(message));
            if (index < 0) return void this.queue.push(message);
            this.waiters.splice(index, 1)[0].resolve(message);
        });
    }

    next(type, ms = 2000) {
        const match = (message) => [type].flat().includes(message.meta.type);
        const index = this.queue.findIndex(match);
        if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0]);
        return new Promise((resolve, reject) => {
            const waiter = { match, resolve: (m) => { clearTimeout(timer); resolve(m); } };
            const timer = setTimeout(() => reject(new Error(`no ${type} within ${ms}ms`)), ms);
            this.waiters.push(waiter);
        });
    }

    send(type, payload = {}, meta = {}) {
        const message = Message.Create({ type, sender: this.id, receiver: SERVER, ...meta }, payload);
        this.socket.send(message.toBinary());
        return message;
    }

    async request(type, payload, reply) {
        this.send(type, payload);
        return (await this.next(reply)).payload;
    }

    async register(payload = {}) {
        const { network } = await this.request(SignalType.Register, { name: "lobby", topology: "chord", ...payload }, SignalType.Registered);
        return network;
    }

    /** Sends `signal.resume` from the socket id; on `resumed` the client talks as `peer`. */
    async resume(peer, token) {
        this.send(SignalType.Resume, token ? { peer, token } : { peer }, { sender: this.socketId });
        const answer = await this.next([SignalType.Resumed, SignalType.Error]);
        if (answer.meta.type === SignalType.Resumed) this.id = peer;
        return answer.meta.type === SignalType.Resumed ? "resumed" : answer.payload.code;
    }

    anchor(network, peer = this.id, keyHash = "key") {
        return this.request(SignalType.Anchor, { network, keyHash, peer }, SignalType.Anchored);
    }
}

let current;

async function setup() {
    const server = http.createServer();
    const wss = new SocketServer({ server, strikes: 1000 });
    server.listen(0);
    await once(server, "listening");
    const clients = [];
    current = {
        wss,
        async connect() {
            const client = new Client(new WebSocket(`ws://localhost:${server.address().port}`));
            clients.push(client);
            const { id, token } = (await client.next(SignalType.Welcome)).payload;
            client.id = client.socketId = id;
            client.token = token;
            return client;
        },
        async gone(client) {
            const socket = wss.sockets.get(client.socketId);
            client.socket.close();
            await once(socket, "close");
        },
        async teardown() {
            wss.close();
            await new Promise(resolve => server.close(resolve));
        },
    };
    return current;
}

afterEach(async () => {
    await current?.teardown();
    current = undefined;
});

describe("anchors", { timeout: 5000 }, () => {
    it("fills up to the target and refuses the next", async () => {
        const t = await setup();
        const [a, b, c] = [await t.connect(), await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });

        assert.deepStrictEqual(await b.anchor(network), { network: network.id, ok: true, existed: true, entry: a.id });
        assert.deepStrictEqual(await c.anchor(network), { network: network.id, ok: false, existed: true, entry: a.id });
    });

    it("tells the anchors the set when it changes", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });
        assert.deepStrictEqual((await a.next(SignalType.Anchors)).payload.anchors, [a.id]);

        await b.anchor(network);
        assert.deepStrictEqual((await a.next(SignalType.Anchors)).payload, { network: network.id, anchors: [a.id, b.id], target: 2 });
        assert.deepStrictEqual((await b.next(SignalType.Anchors)).payload.anchors, [a.id, b.id]);
    });

    it("deletes the network when its last anchor closes", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });
        await b.anchor(network);

        await t.gone(a);
        assert.strictEqual(t.wss.networks.has(network.id), true);
        await t.gone(b);
        assert.strictEqual(t.wss.networks.size, 0);
    });

    it("re-creates a network it forgot, then answers existed with the lowest anchor", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });
        await t.gone(a);
        assert.strictEqual(t.wss.networks.size, 0);

        assert.deepStrictEqual(await b.anchor(network), { network: network.id, ok: true, existed: false });
        const c = await t.connect();
        assert.deepStrictEqual(await c.anchor(network), { network: network.id, ok: true, existed: true, entry: b.id });
    });

    it("refuses a wrong key hash", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });

        b.send(SignalType.Anchor, { network, keyHash: "other", peer: b.id });
        assert.strictEqual((await b.next(SignalType.Error)).payload.code, "forbidden");
    });

    it("unanchor removes the anchor", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });
        await b.anchor(network);
        b.send(SignalType.Unanchor, { network: network.id });

        let set;
        do set = (await a.next(SignalType.Anchors)).payload.anchors;
        while (set.length > 1);
        assert.deepStrictEqual(set, [a.id]);
    });
});

describe("aliases", { timeout: 5000 }, () => {
    it("forwards to a socket by the peer id it anchored under", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });
        await b.anchor(network, "peer-b");

        a.send("chat", { hi: 1 }, { receiver: "peer-b" });
        const message = await b.next("chat");
        assert.strictEqual(message.meta.sender, a.id);
        assert.strictEqual(t.wss.aliases.get("peer-b"), b.id);
    });

    it("lets a socket send as the alias it holds, and no other", async () => {
        const t = await setup();
        const [a, b, c] = [await t.connect(), await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });
        await b.anchor(network, "peer-b");

        b.send("chat", { hi: 1 }, { sender: "peer-b", receiver: a.id });
        assert.strictEqual((await a.next("chat")).meta.sender, "peer-b");

        c.send("chat", { hi: 2 }, { sender: "peer-b", receiver: a.id });
        assert.strictEqual((await c.next(SignalType.Error)).payload.code, "spoof");
    });

    it("hands a joiner the alias as entry and removes it on close", async () => {
        const t = await setup();
        const [a, b, c] = [await t.connect(), await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });
        await b.anchor(network, "peer-b");
        assert.strictEqual((await c.anchor(network, "peer-c")).entry, a.id);

        await t.gone(b);
        assert.strictEqual(t.wss.aliases.has("peer-b"), false);
        assert.deepStrictEqual(t.wss.networks.get(network.id).anchors.includes("peer-b"), false);
    });

    it("refuses an alias that is another live socket's id", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });

        b.send(SignalType.Anchor, { network, keyHash: "key", peer: a.id });
        assert.strictEqual((await b.next(SignalType.Error)).payload.code, "forbidden");
        assert.strictEqual(t.wss.aliases.size, 0);
    });
});

describe("resume", { timeout: 5000 }, () => {
    it("takes a free peer id without a token, and talks and is reached as it", async () => {
        const t = await setup();
        const [a, b, c] = [await t.connect(), await t.connect(), await t.connect()];
        const old = a.id;
        await t.gone(a);

        assert.strictEqual(await b.resume(old), "resumed");
        c.send("chat", { hi: 1 }, { receiver: old });
        assert.strictEqual((await b.next("chat")).meta.receiver, old);
        b.send("chat", { hi: 2 }, { receiver: c.id });
        assert.strictEqual((await c.next("chat")).meta.sender, old);
    });

    it("refuses a taken peer id without its token, or with a wrong one", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];

        assert.strictEqual(await b.resume(a.id), "forbidden");
        assert.strictEqual(await b.resume(a.id, b.token), "forbidden");
        assert.strictEqual(t.wss.aliases.size, 0);
    });

    it("takes a taken peer id over with its token and drops what it anchored", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ keyHash: "key" });
        const closed = once(a.socket, "close");

        assert.strictEqual(await b.resume(a.id, a.token), "resumed");
        await closed;
        assert.strictEqual(t.wss.networks.has(network.id), false);
        assert.strictEqual(t.wss.aliases.get(a.id), b.socketId);
    });

    it("keeps a network the resumed peer re-anchors, under its old id", async () => {
        const t = await setup();
        const [a, b] = [await t.connect(), await t.connect()];
        const network = await a.register({ keyHash: "key" });

        assert.strictEqual(await b.resume(a.id, a.token), "resumed");
        const answer = await b.anchor(network);
        assert.strictEqual(answer.ok, true);
        assert.deepStrictEqual(t.wss.networks.get(network.id).anchors, [a.id]);

        // the old socket's close comes after and must not drop it again
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(t.wss.networks.has(network.id), true);
    });

    it("leaves no network behind when a client that forgot it registers again", async () => {
        const t = await setup();
        const a = await t.connect();
        await a.register();
        let socket = a;
        for (let blip = 0; blip < 3; blip++)
        {
            socket = await t.connect();
            assert.strictEqual(await socket.resume(a.id, a.token), "resumed");
            await socket.register();
        }
        assert.strictEqual(t.wss.list().length, 1);
    });

    it("tells the other anchors when a takeover drops the peer", async () => {
        const t = await setup();
        const [a, b, c] = [await t.connect(), await t.connect(), await t.connect()];
        const network = await a.register({ keyHash: "key", anchors: 2 });
        await b.anchor(network);
        await a.next(SignalType.Anchors);
        await b.next(SignalType.Anchors);

        assert.strictEqual(await c.resume(a.id, a.token), "resumed");
        const { anchors } = (await b.next(SignalType.Anchors)).payload;
        assert.deepStrictEqual(anchors, [b.id]);
    });

    it("joins, registers and anchors as the resumed peer id", async () => {
        const t = await setup();
        const [a, b, c] = [await t.connect(), await t.connect(), await t.connect()];
        const network = await a.register({ anchors: 2, keyHash: "key" });
        const old = c.id;
        await t.gone(c);
        assert.strictEqual(await b.resume(old), "resumed");

        b.send(SignalType.Join, { network: network.id });
        assert.strictEqual((await a.next("network.join")).meta.sender, old);
        assert.strictEqual((await b.anchor(network)).ok, true);
        const own = await b.register({ keyHash: "key" });
        assert.deepStrictEqual(t.wss.networks.get(own.id).anchors, [old]);
    });

    it("lets a socket take only one peer id", async () => {
        const t = await setup();
        const [a, b, c] = [await t.connect(), await t.connect(), await t.connect()];
        const [x, y] = [a.id, b.id];
        await t.gone(a);
        await t.gone(b);

        assert.strictEqual(await c.resume(x), "resumed");
        assert.strictEqual(await c.resume(y), "forbidden");
    });
});
