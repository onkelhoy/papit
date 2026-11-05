import * as ws from "ws";
import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
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
 */
export class SocketServer extends ws.WebSocketServer {
    private heartbeat_timer: NodeJS.Timeout;

    public sockets!: Map<string, Socket>;
    public registry!: Registry;
    // peer id → socket id, for anchors whose peer id isn't the id of the socket they talk through
    public aliases!: Map<PeerId, string>;
    declare public options: ServerOptions;

    constructor(options: ServerOptions = {}, callback?: () => void) {
        super({ maxPayload: MAX_MESSAGE_BYTES, ...options }, callback);
        this.sockets = new Map();
        this.aliases = new Map();
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

        this.send(socket, SignalType.Welcome, { id: socket.id });
    }

    private handleClose(socket: Socket) {
        // replaced by a newer socket with the same id
        if (this.sockets.get(socket.id) !== socket) return;

        this.sockets.delete(socket.id);
        const gone = [socket.id];
        for (const [alias, id] of this.aliases)
        {
            if (id !== socket.id) continue;
            this.aliases.delete(alias);
            gone.push(alias);
        }
        for (const peer of gone) this.deliver(this.registry.drop(peer));
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
            if (meta.sender !== socket.id) return void this.error(socket, "spoof", `sender does not match the socket id (type ${meta.type}, sender ${meta.sender})`, meta.id);
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

        switch (meta.type)
        {
            case SignalType.Register: return this.deliver(this.registry.register(socket.id, payload));
            case SignalType.Update: return this.deliver(this.registry.update(socket.id, payload, meta.id));
            case SignalType.Unregister: return this.deliver(this.registry.unregister(socket.id, payload, meta.id));
            case SignalType.List: return this.send(socket, SignalType.Networks, { networks: this.list() });
            case SignalType.Join: return this.deliver(this.registry.join(socket.id, payload, meta.id));
            case SignalType.Leave: return this.deliver([socket.id, this.peerOf(socket)].flatMap(peer => this.registry.leave(peer, payload.network)));
            case SignalType.Anchor: return this.anchor(socket, payload, meta.id);
            case SignalType.Unanchor: return this.deliver(this.registry.unanchor(this.peerOf(socket), payload));
            case SignalType.Drain: return this.drain(socket, payload);
            default: return this.error(socket, "unsupported", `unsupported message: ${meta.type}`, meta.id);
        }
    }

    // signal handlers
    private anchor(socket: Socket, payload: PayloadMap[SignalType.Anchor], ref: string) {
        const { peer } = payload;
        if (peer !== socket.id)
        {
            const taken = this.sockets.has(peer) || (this.aliases.has(peer) && this.sockets.has(this.aliases.get(peer)!) && this.aliases.get(peer) !== socket.id);
            if (taken) return void this.error(socket, "forbidden", "that peer id belongs to another socket", ref);
            this.aliases.set(peer, socket.id);
        }
        this.deliver(this.registry.anchor(socket.id, payload, ref));
    }

    // everything forwarded so far is ahead of this answer on the socket, so the client can close without losing any
    private drain(socket: Socket, payload: PayloadMap[SignalType.Drain]) {
        socket.draining = payload.draining;
        if (payload.draining) this.send(socket, SignalType.Drained, {});
    }

    // helpers
    /** The socket a peer id talks through: its own, or the one it is an alias of. */
    private socketOf(peer: PeerId) {
        return this.sockets.get(peer) ?? this.sockets.get(this.aliases.get(peer) ?? "");
    }

    /** The id a socket anchors under: an alias it holds, else its own. */
    private peerOf(socket: Socket) {
        for (const [alias, id] of this.aliases) if (id === socket.id) return alias;
        return socket.id;
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
