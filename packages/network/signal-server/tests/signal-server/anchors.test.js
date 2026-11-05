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
        const match = (message) => message.meta.type === type;
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
            client.id = (await client.next(SignalType.Welcome)).payload.id;
            return client;
        },
        async gone(client) {
            const socket = wss.sockets.get(client.id);
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
