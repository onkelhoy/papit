import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { once } from "node:events";

import WebSocket from "ws";
import { Arguments } from "@papit/arguments";
import {
    Message,
    SERVER,
    BROADCAST,
    DEFAULT_TTL,
    SignalType,
    NetworkType,
    HandshakeType,
} from "@papit/peer-message";
import { SocketServer, start, close } from "@papit/signal-server";

// ############ HELPERS #####################

class Client {
    constructor(socket) {
        this.socket = socket;
        this.queue = [];
        this.waiters = [];
        this.closed = new Promise(resolve => socket.once("close", (code) => resolve(code)));

        socket.on("message", (data) => {
            const message = Message.FromBinary(new Uint8Array(data), false);
            try { message.parse(); } catch { /* keep bytes */ }
            this.push(message);
        });
    }

    push(message) {
        const index = this.waiters.findIndex(w => w.match(message));
        if (index < 0) return void this.queue.push(message);
        const [waiter] = this.waiters.splice(index, 1);
        waiter.resolve(message);
    }

    /** Resolves with the next message (of `type`, when given), queued or future. Rejects after `ms`. */
    next(type, ms = 2000) {
        const match = (message) => !type || message.meta.type === type;
        const index = this.queue.findIndex(match);
        if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0]);

        return new Promise((resolve, reject) => {
            const waiter = {
                match,
                resolve: (message) => { clearTimeout(timer); resolve(message); },
            };
            const timer = setTimeout(() => {
                this.waiters.splice(this.waiters.indexOf(waiter), 1);
                reject(new Error(`no ${type ?? "message"} within ${ms}ms`));
            }, ms);
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
        const { network } = await this.request(SignalType.Register, { name: "lobby", topology: "mesh", ...payload }, SignalType.Registered);
        return network;
    }
}

let current;

async function setup(options = {}) {
    const server = http.createServer();
    const wss = new SocketServer({ server, strikes: 1000, ...options });
    server.listen(0);
    await once(server, "listening");
    const port = server.address().port;
    const clients = [];
    let closed = false;

    current = {
        wss,
        port,
        async connect(clientOptions) {
            const client = new Client(new WebSocket(`ws://localhost:${port}`, clientOptions));
            clients.push(client);
            const welcome = await client.next(SignalType.Welcome);
            client.id = welcome.payload.id;
            client.welcome = welcome;
            return client;
        },
        /** Resolves once the server has finished handling `client`'s disconnect. */
        serverClose(client) {
            return once(wss.sockets.get(client.id), "close");
        },
        async teardown() {
            if (!closed) wss.close();
            closed = true;
            await Promise.all(clients.map(c => c.closed));
            await new Promise(resolve => server.close(resolve));
        },
        markClosed() { closed = true; },
    };
    return current;
}

afterEach(async () => {
    await current?.teardown();
    current = undefined;
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ############ TESTS #####################

describe("connection", { timeout: 5000 }, () => {

    it("welcomes a socket with its id", async () => {
        const t = await setup();
        const a = await t.connect();

        assert.match(a.id, UUID);
        assert.strictEqual(a.welcome.meta.sender, SERVER);
        assert.strictEqual(a.welcome.meta.receiver, a.id);
        assert.strictEqual(t.wss.sockets.get(a.id)?.id, a.id);
    });

    it("uses a custom setClientID", async () => {
        let n = 0;
        const t = await setup({ setClientID: () => `peer-${++n}` });

        assert.strictEqual((await t.connect()).id, "peer-1");
        assert.strictEqual((await t.connect()).id, "peer-2");
    });

    it("terminates the old socket when an id is reused", async () => {
        const t = await setup({ setClientID: () => "same" });
        const a = await t.connect();
        const b = await t.connect();

        await a.closed;
        assert.strictEqual(b.id, "same");
        assert.strictEqual(t.wss.sockets.size, 1);

        // the new socket still works
        const { networks } = await b.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, []);
    });
});

describe("networks", { timeout: 5000 }, () => {

    it("registers a network with the sender as host", async () => {
        const t = await setup();
        const a = await t.connect();
        const network = await a.register({ name: "lobby", topology: "star", meta: { game: "x" } });

        assert.match(network.id, UUID);
        assert.deepStrictEqual(network, {
            id: network.id,
            name: "lobby",
            host: a.id,
            topology: "star",
            private: false,
            size: 1,
            meta: { game: "x" },
        });
    });

    it("lists public networks only, without secrets", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const lobby = await a.register({ name: "lobby", password: "pw" });
        await a.register({ name: "secret", private: true });

        const { networks } = await b.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, [lobby]);
        assert.ok(!("passwordHash" in networks[0]));
        assert.ok(!("members" in networks[0]));
        assert.ok(!("password" in networks[0]));
    });

    it("lets only the host update", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register();

        const error = await b.request(SignalType.Update, { network: network.id, name: "mine" }, SignalType.Error);
        assert.strictEqual(error.code, "forbidden");

        const updated = await a.request(SignalType.Update, { network: network.id, name: "renamed", private: true }, SignalType.Updated);
        assert.deepStrictEqual(updated.network, { ...network, name: "renamed", private: true });

        const { networks } = await b.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, []);
    });

    it("lets only the host unregister", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register();

        const error = await b.request(SignalType.Unregister, { network: network.id }, SignalType.Error);
        assert.strictEqual(error.code, "forbidden");

        a.send(SignalType.Unregister, { network: network.id });
        const { networks } = await a.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, []);
        assert.strictEqual(t.wss.networks.size, 0);
    });

    it("answers not-found for an unknown network", async () => {
        const t = await setup();
        const a = await t.connect();

        assert.strictEqual((await a.request(SignalType.Update, { network: "nope" }, SignalType.Error)).code, "not-found");
        assert.strictEqual((await a.request(SignalType.Unregister, { network: "nope" }, SignalType.Error)).code, "not-found");
    });
});

describe("media plan", { timeout: 5000 }, () => {
    const media = {
        channels: { chat: { ordered: true }, state: { ordered: false, maxRetransmits: 0 } },
        streams: { camera: { kind: "video" }, mic: { kind: "audio" } },
    };

    it("stores the plan on register and returns it in signal.registered", async () => {
        const t = await setup();
        const a = await t.connect();
        const network = await a.register({ media });

        assert.deepStrictEqual(network.media, media);
        assert.deepStrictEqual(t.wss.networks.get(network.id).media, media);
    });

    it("leaves media out when none was registered", async () => {
        const t = await setup();
        const a = await t.connect();
        const network = await a.register();

        assert.ok(!("media" in network));
    });

    it("returns the plan in signal.networks", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register({ media });

        const { networks } = await b.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, [network]);
        assert.deepStrictEqual(networks[0].media, media);
    });

    it("replaces the plan on update and keeps it when update omits it", async () => {
        const t = await setup();
        const a = await t.connect();
        const network = await a.register({ media });

        const next = { streams: { screen: { kind: "video" } } };
        const updated = await a.request(SignalType.Update, { network: network.id, media: next }, SignalType.Updated);
        assert.deepStrictEqual(updated.network.media, next);

        const renamed = await a.request(SignalType.Update, { network: network.id, name: "renamed" }, SignalType.Updated);
        assert.deepStrictEqual(renamed.network.media, next);
        assert.strictEqual(renamed.network.name, "renamed");

        const cleared = await a.request(SignalType.Update, { network: network.id, media: {} }, SignalType.Updated);
        assert.deepStrictEqual(cleared.network.media, {});
    });

    it("lets only the host change the plan", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register({ media });

        const error = await b.request(SignalType.Update, { network: network.id, media: {} }, SignalType.Error);
        assert.strictEqual(error.code, "forbidden");
        assert.deepStrictEqual(t.wss.networks.get(network.id).media, media);
    });

    it("answers invalid for a bad plan on register or update", async () => {
        const t = await setup();
        const a = await t.connect();

        const reserved = await a.request(SignalType.Register, { name: "x", topology: "mesh", media: { channels: { _system: {} } } }, SignalType.Error);
        assert.strictEqual(reserved.code, "invalid");
        assert.strictEqual(t.wss.networks.size, 0);

        const network = await a.register({ media });
        const kind = await a.request(SignalType.Update, { network: network.id, media: { streams: { cam: { kind: "data" } } } }, SignalType.Error);
        assert.strictEqual(kind.code, "invalid");
        assert.deepStrictEqual(t.wss.networks.get(network.id).media, media);
    });

    it("hands the plan to the next host in signal.host", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register({ media });

        b.send(SignalType.Join, { network: network.id });
        await a.next(NetworkType.Join);

        a.send(SignalType.Leave, { network: network.id });
        const { network: info } = (await b.next(SignalType.Host)).payload;
        assert.strictEqual(info.host, b.id);
        assert.deepStrictEqual(info.media, media);
    });
});

describe("join", { timeout: 5000 }, () => {

    it("passes the newcomer's profile on in network.join", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const c = await t.connect();
        const network = await a.register();

        b.send(SignalType.Join, { network: network.id, profile: { name: "Bea", color: "#0af" } });
        const join = await a.next(NetworkType.Join);
        assert.strictEqual(join.meta.sender, b.id);
        assert.deepStrictEqual(join.payload, { profile: { name: "Bea", color: "#0af" } });

        c.send(SignalType.Join, { network: network.id });
        assert.deepStrictEqual((await a.next(NetworkType.Join)).payload, {});
    });

    it("answers invalid for an oversized profile", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register();

        const error = await b.request(SignalType.Join, { network: network.id, profile: { name: "x".repeat(2000) } }, SignalType.Error);
        assert.strictEqual(error.code, "invalid");
    });


    it("forwards network.join to the host with the newcomer as sender", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register();

        b.send(SignalType.Join, { network: network.id });
        const join = await a.next(NetworkType.Join);

        assert.strictEqual(join.meta.sender, b.id);
        assert.strictEqual(join.meta.receiver, a.id);
        assert.strictEqual(join.meta.network, network.id);
        assert.deepStrictEqual(join.payload, {});

        const { networks } = await b.request(SignalType.List, {}, SignalType.Networks);
        assert.strictEqual(networks[0].size, 2);
    });

    it("rejects a wrong or missing password", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register({ password: "pw" });

        assert.strictEqual((await b.request(SignalType.Join, { network: network.id, password: "nope" }, SignalType.Error)).code, "forbidden");
        assert.strictEqual((await b.request(SignalType.Join, { network: network.id }, SignalType.Error)).code, "forbidden");

        b.send(SignalType.Join, { network: network.id, password: "pw" });
        const join = await a.next(NetworkType.Join);
        assert.strictEqual(join.meta.sender, b.id);
        assert.deepStrictEqual(join.payload, {}); // the password is not passed on
    });

    it("answers not-found for an unknown network", async () => {
        const t = await setup();
        const a = await t.connect();

        assert.strictEqual((await a.request(SignalType.Join, { network: "nope" }, SignalType.Error)).code, "not-found");
    });

    it("uses a custom pickEntry", async () => {
        const calls = [];
        const t = await setup({
            pickEntry: (network, members, newcomer) => {
                calls.push({ network: network.id, members: [...members], newcomer });
                return members[members.length - 1];
            },
        });
        const a = await t.connect();
        const b = await t.connect();
        const c = await t.connect();
        const network = await a.register();

        b.send(SignalType.Join, { network: network.id });
        assert.strictEqual((await a.next(NetworkType.Join)).meta.sender, b.id);

        c.send(SignalType.Join, { network: network.id });
        const join = await b.next(NetworkType.Join);
        assert.strictEqual(join.meta.sender, c.id);
        assert.strictEqual(join.meta.receiver, b.id);

        assert.deepStrictEqual(calls, [
            { network: network.id, members: [a.id], newcomer: b.id },
            { network: network.id, members: [a.id, b.id], newcomer: c.id },
        ]);
    });
});

describe("forwarding", { timeout: 5000 }, () => {

    it("forwards a message from peer to peer", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();

        const sent = a.send("chat", { text: "hej åäö" }, { receiver: b.id });
        const received = await b.next("chat");

        assert.strictEqual(received.meta.id, sent.meta.id);
        assert.strictEqual(received.meta.sender, a.id);
        assert.deepStrictEqual(received.meta.hops, [a.id, SERVER]);
        assert.strictEqual(received.meta.ttl, DEFAULT_TTL - 1);
        assert.deepStrictEqual(received.payload, { text: "hej åäö" });
    });

    it("forwards a reserved peer message with its payload intact", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register();

        const payload = { network, members: [a.id], connect: [a.id] };
        a.send(NetworkType.Welcome, payload, { receiver: b.id });
        assert.deepStrictEqual((await b.next(NetworkType.Welcome)).payload, payload);
    });

    it("drops a message whose ttl is spent", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();

        a.send("chat", { n: 1 }, { receiver: b.id, ttl: 1 });
        a.send("chat", { n: 2 }, { receiver: b.id });

        assert.deepStrictEqual((await b.next()).payload, { n: 2 });
    });

    it("answers signal.unreachable for an unknown receiver", async () => {
        const t = await setup();
        const a = await t.connect();

        const sent = a.send("chat", {}, { receiver: "ghost" });
        const { payload, meta } = await a.next(SignalType.Unreachable);

        assert.deepStrictEqual(payload, { receiver: "ghost", ref: sent.meta.id });
        assert.strictEqual(meta.sender, SERVER);
        assert.strictEqual(meta.receiver, a.id);
    });

    it("does not fan out broadcasts", async () => {
        const t = await setup();
        const a = await t.connect();

        const sent = a.send("chat", {}, { receiver: BROADCAST });
        const error = await a.next(SignalType.Error);
        assert.strictEqual(error.payload.code, "unsupported");
        assert.strictEqual(error.payload.ref, sent.meta.id);
    });

    it("answers unsupported for non-signal types sent to the server", async () => {
        const t = await setup();
        const a = await t.connect();

        assert.strictEqual((await a.request("chat", {}, SignalType.Error)).code, "unsupported");
        assert.strictEqual((await a.request(SignalType.Welcome, { id: "x" }, SignalType.Error)).code, "unsupported");
    });
});

describe("untrusted input", { timeout: 5000 }, () => {

    it("rejects a spoofed sender", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();

        a.send("chat", { text: "spoofed" }, { sender: b.id, receiver: b.id });
        assert.strictEqual((await a.next(SignalType.Error)).payload.code, "spoof");

        a.send("chat", { text: "real" }, { receiver: b.id });
        assert.deepStrictEqual((await b.next()).payload, { text: "real" });
    });

    it("forbids signal.* messages to anyone but the server", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register();

        const sent = a.send(SignalType.Host, { network }, { receiver: b.id });
        const error = await a.next(SignalType.Error);
        assert.strictEqual(error.payload.code, "forbidden");
        assert.strictEqual(error.payload.ref, sent.meta.id);

        a.send("chat", { text: "real" }, { receiver: b.id });
        assert.deepStrictEqual((await b.next()).payload, { text: "real" });
    });

    it("answers invalid for garbage and stays open", async () => {
        const t = await setup();
        const a = await t.connect();

        a.socket.send(new Uint8Array([0, 0, 0, 3, 1, 2, 3]));
        assert.strictEqual((await a.next(SignalType.Error)).payload.code, "invalid");

        const { networks } = await a.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, []);
    });

    it("answers invalid for a bad reserved payload", async () => {
        const t = await setup();
        const a = await t.connect();

        assert.strictEqual((await a.request(SignalType.Join, { nope: true }, SignalType.Error)).code, "invalid");
    });

    it("closes on an oversized frame", async () => {
        const t = await setup({ maxPayload: 1024 });
        const a = await t.connect();

        a.send("chat", "x".repeat(2048), { receiver: a.id });
        assert.strictEqual(await a.closed, 1009);
    });

    it("answers a text frame with signal.error and closes", async () => {
        const t = await setup();
        const a = await t.connect();

        a.socket.send("hello");
        assert.strictEqual((await a.next(SignalType.Error)).payload.code, "invalid");
        await a.closed;
    });

    it("closes a spamming socket", async () => {
        const t = await setup({ strikes: 3, spam_duration: 10_000 });
        const a = await t.connect();

        for (let i = 0; i < 5; i++) a.send(SignalType.List);
        await a.closed;
    });
});

describe("rate limits", { timeout: 5000 }, () => {
    const candidate = (i) => ({ candidate: { candidate: `candidate:${i}`, sdpMid: "0", sdpMLineIndex: 0 } });

    it("delivers a forwarded candidate burst under the default limits", async () => {
        const t = await setup({ strikes: undefined }); // real spam defaults
        const a = await t.connect();
        const b = await t.connect();

        for (let i = 0; i < 30; i++) a.send(HandshakeType.Candidate, candidate(i), { receiver: b.id });
        for (let i = 0; i < 30; i++)
        {
            assert.deepStrictEqual((await b.next(HandshakeType.Candidate)).payload, candidate(i));
        }

        const { networks } = await a.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, []);
        assert.strictEqual(a.socket.readyState, WebSocket.OPEN);
        assert.ok(!a.queue.some(m => m.meta.type === SignalType.Error));
    });

    it("answers rate for forwarded messages over forward_rate, without closing", async () => {
        const t = await setup({ forward_rate: 5 });
        const a = await t.connect();
        const b = await t.connect();

        const sent = [];
        for (let i = 0; i < 10; i++) sent.push(a.send("chat", { i }, { receiver: b.id }));
        await a.request(SignalType.List, {}, SignalType.Networks); // replies are ordered, so every rate error is queued by now

        const errors = a.queue.filter(m => m.meta.type === SignalType.Error);
        assert.strictEqual(errors.length, 5);
        assert.ok(errors.every(e => e.payload.code === "rate"));
        assert.deepStrictEqual(errors.map(e => e.payload.ref), sent.slice(5).map(m => m.meta.id));

        for (let i = 0; i < 5; i++) assert.deepStrictEqual((await b.next("chat")).payload, { i });
        assert.strictEqual(a.socket.readyState, WebSocket.OPEN);
    });
});

describe("leaving", { timeout: 5000 }, () => {

    it("hands the network to the oldest member when the host disconnects", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const c = await t.connect();
        const network = await a.register();

        b.send(SignalType.Join, { network: network.id });
        await a.next(NetworkType.Join);
        c.send(SignalType.Join, { network: network.id });
        await a.next(NetworkType.Join);

        a.socket.close();
        const { payload, meta } = await b.next(SignalType.Host);

        assert.strictEqual(meta.sender, SERVER);
        assert.deepStrictEqual(payload.network, { ...network, host: b.id, size: 2 });
        assert.deepStrictEqual(t.wss.networks.get(network.id).members, [b.id, c.id]);
    });

    it("hands the network over when the host sends signal.leave", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register();

        b.send(SignalType.Join, { network: network.id });
        await a.next(NetworkType.Join);

        a.send(SignalType.Leave, { network: network.id });
        assert.strictEqual((await b.next(SignalType.Host)).payload.network.host, b.id);
    });

    it("shrinks the network when a member leaves", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        const network = await a.register();

        b.send(SignalType.Join, { network: network.id });
        await a.next(NetworkType.Join);
        b.send(SignalType.Leave, { network: network.id });

        const { networks } = await b.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, [network]);
    });

    it("deletes the network when the last member disconnects", async () => {
        const t = await setup();
        const a = await t.connect();
        const b = await t.connect();
        await a.register();

        const handled = t.serverClose(a);
        a.socket.close();
        await handled;

        assert.strictEqual(t.wss.networks.size, 0);
        assert.strictEqual(t.wss.sockets.has(a.id), false);
        const { networks } = await b.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, []);
    });

    it("deletes the network when the last member sends signal.leave", async () => {
        const t = await setup();
        const a = await t.connect();
        const network = await a.register();

        a.send(SignalType.Leave, { network: network.id });
        const { networks } = await a.request(SignalType.List, {}, SignalType.Networks);
        assert.deepStrictEqual(networks, []);
        assert.strictEqual(t.wss.networks.size, 0);
    });
});

describe("heartbeat", { timeout: 5000 }, () => {

    it("terminates a socket that stops answering pings, keeps a live one", async () => {
        const t = await setup({ heartbeat_interval: 30 });
        const live = await t.connect();
        const dead = await t.connect({ autoPong: false });

        await dead.closed;
        assert.strictEqual(live.socket.readyState, WebSocket.OPEN);
    });
});

describe("close", { timeout: 5000 }, () => {

    it("terminates every client and stops the server", async () => {
        const t = await setup({ heartbeat_interval: 30 });
        const a = await t.connect();
        const b = await t.connect();

        const stopped = once(t.wss, "close");
        t.wss.close();
        t.markClosed();

        await Promise.all([a.closed, b.closed, stopped]);
        assert.strictEqual(t.wss.clients.size, 0);
    });
});

describe("http", { timeout: 5000 }, () => {

    it("serves GET /health with CORS headers", async () => {
        Arguments.set("port", "0");
        const server = start();
        try
        {
            if (!server.listening) await once(server, "listening");
            const response = await fetch(`http://localhost:${server.address().port}/health`);
            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.headers.get("access-control-allow-origin"), "*");
            assert.deepStrictEqual(await response.json(), { ok: true });
        }
        finally
        {
            close();
        }
    });

    it("listens on process.env.PORT without --port, and --port wins over it", async () => {
        const previous = process.env.PORT;
        try
        {
            Arguments.delete("port");
            process.env.PORT = "0";
            let server = start();
            if (!server.listening) await once(server, "listening");
            assert.ok(server.address().port > 0 && server.address().port !== 3000);
            close();

            // a privileged port would fail to bind, so listening proves --port was used
            process.env.PORT = "1";
            Arguments.set("port", "0");
            server = start();
            if (!server.listening) await once(server, "listening");
            assert.notStrictEqual(server.address().port, 1);
        }
        finally
        {
            close();
            if (previous === undefined) delete process.env.PORT;
            else process.env.PORT = previous;
        }
    });

    it("serves GET /networks, OPTIONS and 405", async () => {
        Arguments.set("port", "0");
        const server = start();
        try
        {
            if (!server.listening) await once(server, "listening");
            const base = `http://localhost:${server.address().port}`;

            let response = await fetch(`${base}/networks`);
            assert.strictEqual(response.status, 200);
            assert.deepStrictEqual(await response.json(), []);

            const client = new Client(new WebSocket(base.replace("http", "ws")));
            client.id = (await client.next(SignalType.Welcome)).payload.id;
            const network = await client.register({ name: "http" });
            await client.register({ name: "hidden", private: true });

            response = await fetch(`${base}/networks`);
            assert.deepStrictEqual(await response.json(), [network]);

            assert.strictEqual((await fetch(`${base}/networks`, { method: "OPTIONS" })).status, 204);
            assert.strictEqual((await fetch(`${base}/networks`, { method: "POST" })).status, 405);
            assert.strictEqual((await fetch(`${base}/other`)).status, 405);

            const closed = client.closed;
            close();
            await closed;
        }
        finally
        {
            close();
        }
    });
});
