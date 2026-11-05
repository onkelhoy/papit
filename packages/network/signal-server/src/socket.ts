import * as ws from "ws";
import http from "node:http";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
    BROADCAST,
    MAX_MESSAGE_BYTES,
    Message,
    NetworkType,
    Registry,
    SERVER,
    SignalType,
    read,
    relay,
} from "@papit/peer-message";
import type { Meta, NetworkInfo, PayloadMap, PeerId, Reply } from "@papit/peer-message";

import type { ServerOptions, Socket } from "./types";

const hash = (password: string) => createHash("sha256").update(password).digest("hex");

/**
 * WebSocket signalling server for @papit/peer-message.
 * Keeps a network `Registry`, forwards peer messages by `receiver`.
 * Drops a network when its last anchor leaves. Only binary frames are accepted.
 * A socket talks as its own id, or as one earlier peer id it took with `signal.resume` or `signal.anchor`.
 */
export class SocketServer extends ws.WebSocketServer {
    private heartbeat_timer: NodeJS.Timeout;
    private readonly secret: string;

    public sockets!: Map<string, Socket>;
    public registry!: Registry;
    // peer id → socket id, for sockets that talk as a peer id that isn't their own id
    public aliases!: Map<PeerId, string>;
    declare public options: ServerOptions;

    constructor(options: ServerOptions = {}, callback?: () => void) {
        super({ maxPayload: MAX_MESSAGE_BYTES, ...options }, callback);
        this.sockets = new Map();
        this.aliases = new Map();
        this.secret = this.options.secret ?? randomBytes(32).toString("hex");
        this.registry = new Registry({
            hash,
            pickEntry: this.options.pickEntry,
            reachable: peer => {
                const target = this.socketOf(peer);
                return !!target && !target.draining;
            },
        });

        this.on("connection", (socket: Socket, request: http.IncomingMessage) => this.handleConnection(socket, request));
        this.on("error", (error) => this.printerror(error.message));

        // heartbeat
        this.heartbeat_timer = setInterval(() => {
            for (const client of this.clients)
            {
                const socket = client as Socket;
                if (!socket.is_alive)
                {
                    socket.terminate();
                    continue;
                }

                socket.is_alive = false;
                socket.ping();
            }
        }, this.options.heartbeat_interval ?? 2000);
    }

    /** The registered networks, by id. */
    public get networks() {
        return this.registry.networks;
    }

    /** Public networks as clients see them: no password hash, no member list. */
    public list(): NetworkInfo[] {
        return this.registry.list();
    }

    /** Sends a server message (`sender: SERVER`) to `socket`. Ignored when the socket is not open. */
    public send<T extends keyof PayloadMap>(socket: Socket, type: T, payload: PayloadMap[T], meta: Partial<Meta> = {}) {
        if (socket.readyState !== ws.WebSocket.OPEN) return;
        socket.send(Message.Create({ type, sender: SERVER, receiver: socket.id, ...meta }, payload).toBinary());
    }

    /** Terminates every client, stops the heartbeat and closes the server. */
    public close(callback?: (error?: Error) => void) {
        clearInterval(this.heartbeat_timer);
        for (const socket of this.clients)
        {
            socket.terminate();
        }
        super.close(callback);
    }

    // event handlers
    private handleConnection(socket: Socket, request: http.IncomingMessage) {
        socket.id = this.options.setClientID?.(request) ?? randomUUID();
        socket.is_alive = true;
        socket.strike = 0;
        socket.lastmessage = 0;
        socket.tokens = this.options.forward_rate ?? 200;
        socket.refilled_at = performance.now();
        socket.draining = false;
        socket.peer = null;

        const existing = this.sockets.get(socket.id);
        if (existing)
        {
            // same id reconnecting: the registry keeps its memberships, they belong to the id
            existing.terminate();
        }
        this.sockets.set(socket.id, socket);

        socket.on("message", (data: ws.RawData, isBinary: boolean) => this.handleMessage(socket, data, isBinary));
        socket.on("close", () => this.handleClose(socket));
        socket.on("error", (error) => this.printerror(`socket ${socket.id}: ${error.message}`));
        socket.on("pong", () => {
            socket.is_alive = true;
        });

        this.send(socket, SignalType.Welcome, { id: socket.id, token: this.sign(socket.id) });
    }

    private handleClose(socket: Socket) {
        // replaced by a newer socket with the same id
        if (this.sockets.get(socket.id) !== socket) return;

        this.sockets.delete(socket.id);
        const gone = [socket.id];
        if (socket.peer && this.aliases.get(socket.peer) === socket.id)
        {
            this.aliases.delete(socket.peer);
            gone.push(socket.peer);
        }
        // an id another socket resumed lives on there
        for (const peer of gone) if (!this.aliases.has(peer)) this.deliver(this.registry.drop(peer));
    }

    private handleMessage(socket: Socket, data: ws.RawData, isBinary: boolean) {
        try
        {
            if (!isBinary)
            {
                this.error(socket, "invalid", "only binary frames are accepted");
                socket.close(1003);
                return;
            }

            const bytes = Array.isArray(data)
                ? Buffer.concat(data)
                : data instanceof ArrayBuffer ? new Uint8Array(data) : data;

            const message = read(bytes, this.options.maxPayload);

            // server traffic (and garbage) is spam-checked; forwarded traffic spends the forward budget
            if (!message || message.meta.receiver === SERVER)
            {
                if (this.spamcheck(socket))
                {
                    this.printerror(`socket ${socket.id} is spamming server`);
                    socket.close(1008);
                    return;
                }
            }
            else if (!this.spend(socket))
            {
                return void this.error(socket, "rate", "forward rate exceeded", message.meta.id);
            }

            if (!message) return void this.error(socket, "invalid", "malformed message");

            const { meta } = message;
            if (!this.speaksFor(socket, meta.sender)) return void this.error(socket, "spoof", `sender is neither the socket id nor an alias it holds (type ${meta.type}, sender ${meta.sender})`, meta.id);
            if (meta.receiver === SERVER) return void this.handleSignal(socket, message);
            if (meta.type.startsWith("signal.")) return void this.error(socket, "forbidden", "signal messages may only be sent to the server", meta.id);
            if (meta.receiver === BROADCAST) return void this.error(socket, "unsupported", "the server does not broadcast", meta.id);
            // a join only counts when it comes from here, after the password check
            if (meta.type === NetworkType.Join) return void this.error(socket, "forbidden", "join through signal.join", meta.id);

            if (relay(meta, SERVER) !== "forward") return;

            const target = this.socketOf(meta.receiver);
            if (!target || target.draining || target.readyState !== ws.WebSocket.OPEN)
            {
                this.send(socket, SignalType.Unreachable, { receiver: meta.receiver, ref: meta.id });
                return;
            }

            target.send(message.toBinary(true));
        }
        catch (error)
        {
            this.printerror(`socket ${socket.id}: ${(error as Error).message}`);
        }
    }

    private handleSignal(socket: Socket, message: Message) {
        const { meta } = message;
        const payload = message.payload;

        const peer = this.peerOf(socket);

        switch (meta.type)
        {
            case SignalType.Resume: return this.resume(socket, payload, meta.id);
            case SignalType.Register: return this.deliver(this.registry.register(peer, payload));
            case SignalType.Update: return this.deliver(this.registry.update(peer, payload, meta.id));
            case SignalType.Unregister: return this.deliver(this.registry.unregister(peer, payload, meta.id));
            case SignalType.List: return this.send(socket, SignalType.Networks, { networks: this.list() });
            case SignalType.Join: return this.deliver(this.registry.join(peer, payload, meta.id));
            case SignalType.Leave: return this.deliver([...new Set([socket.id, peer])].flatMap(id => this.registry.leave(id, payload.network)));
            case SignalType.Anchor: return this.anchor(socket, payload, meta.id);
            case SignalType.Unanchor: return this.deliver(this.registry.unanchor(peer, payload));
            case SignalType.Drain: return this.drain(socket, payload);
            default: return this.error(socket, "unsupported", `unsupported message: ${meta.type}`, meta.id);
        }
    }

    // signal handlers
    private resume(socket: Socket, payload: PayloadMap[SignalType.Resume], ref: string) {
        const refused = this.claim(socket, payload.peer, payload.token);
        if (refused) return void this.error(socket, "forbidden", refused, ref);
        this.send(socket, SignalType.Resumed, { peer: payload.peer });
    }

    private anchor(socket: Socket, payload: PayloadMap[SignalType.Anchor], ref: string) {
        const refused = this.claim(socket, payload.peer);
        if (refused) return void this.error(socket, "forbidden", refused, ref);
        this.deliver(this.registry.anchor(this.peerOf(socket), payload, ref));
    }

    // everything forwarded so far is ahead of this answer on the socket, so the client can close without losing any
    private drain(socket: Socket, payload: PayloadMap[SignalType.Drain]) {
        socket.draining = payload.draining;
        if (payload.draining) this.send(socket, SignalType.Drained, {});
    }

    // helpers
    /**
     * Lets `socket` talk as `peer`. A free id is first come. A taken one needs the `token` its welcome
     * carried; the stale socket holding it is then closed without dropping what the id belongs to.
     * Returns why it was refused, or null.
     */
    private claim(socket: Socket, peer: PeerId, token?: string): string | null {
        if (peer === this.peerOf(socket)) return null;
        if (socket.peer) return "this socket already talks as another peer id";

        const holder = this.socketOf(peer);
        if (holder && holder !== socket)
        {
            if (!token || !this.verify(peer, token)) return "that peer id belongs to another socket";
            // out of the map first, so its close drops nothing
            if (holder.id === peer) this.sockets.delete(peer);
            holder.peer = null;
            holder.terminate();
        }
        socket.peer = peer;
        this.aliases.set(peer, socket.id);
        return null;
    }

    private sign(id: PeerId) {
        return createHmac("sha256", this.secret).update(id).digest("hex");
    }

    private verify(id: PeerId, token: string) {
        const expected = Buffer.from(this.sign(id));
        const given = Buffer.from(token);
        return given.length === expected.length && timingSafeEqual(given, expected);
    }

    /** The socket a peer id talks through: its own, or the one it is an alias of. */
    private socketOf(peer: PeerId) {
        return this.sockets.get(peer) ?? this.sockets.get(this.aliases.get(peer) ?? "");
    }

    /** A socket sends as its own id, or as a peer id it anchored under (an alias). */
    private speaksFor(socket: Socket, sender: PeerId) {
        return sender === socket.id || this.aliases.get(sender) === socket.id;
    }

    /** The id a socket talks as: the peer id it took, else its own. */
    private peerOf(socket: Socket) {
        return socket.peer ?? socket.id;
    }

    private deliver(replies: Reply[]) {
        for (const { to, message } of replies)
        {
            const target = this.socketOf(to);
            if (target?.readyState === ws.WebSocket.OPEN) target.send(message.toBinary());
        }
    }

    private error(socket: Socket, code: string, message: string, ref?: string) {
        this.send(socket, SignalType.Error, ref ? { code, message, ref } : { code, message });
    }

    private spamcheck(socket: Socket): boolean {
        const maxstrikes = this.options.strikes ?? 5;
        if (socket.lastmessage)
        {
            const duration = performance.now() - socket.lastmessage;
            if (duration < (this.options.spam_duration ?? 200))
            {
                // user sent message before duration time has passed, user should have MAXSTRIKES strikes and then banned
                socket.strike++;
            }
            else if (socket.strike < maxstrikes && duration >= (this.options.spam_reset ?? 1500))
            {
                socket.strike = 0;
            }
        }

        socket.lastmessage = performance.now();
        return socket.strike >= maxstrikes;
    }

    /** Token bucket: holds up to `forward_rate` tokens, refilled at `forward_rate` per second. */
    private spend(socket: Socket): boolean {
        const rate = this.options.forward_rate ?? 200;
        const now = performance.now();
        socket.tokens = Math.min(rate, socket.tokens + (now - socket.refilled_at) * rate / 1000);
        socket.refilled_at = now;

        if (socket.tokens < 1) return false;
        socket.tokens--;
        return true;
    }

    private printerror(error: string) {
        console.log("[signal-server] error", performance.now(), error);
    }
}
