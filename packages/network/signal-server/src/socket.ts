import * as ws from "ws";
import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
    BROADCAST,
    MAX_MESSAGE_BYTES,
    Message,
    NetworkType,
    SERVER,
    SignalType,
    read,
    relay,
} from "@papit/peer-message";
import type { Meta, NetworkInfo, PayloadMap } from "@papit/peer-message";

import type { Network, ServerOptions, Socket } from "./types";

const hash = (password: string) => createHash("sha256").update(password).digest("hex");

/**
 * WebSocket signalling server for @papit/peer-message.
 * Keeps a network registry, forwards peer messages by `receiver`, and hands a network
 * to its oldest member when the host leaves. Only binary frames are accepted.
 */
export class SocketServer extends ws.WebSocketServer {
    private heartbeat_timer: NodeJS.Timeout;

    public sockets!: Map<string, Socket>;
    public networks!: Map<string, Network>;
    declare public options: ServerOptions;

    constructor(options: ServerOptions = {}, callback?: () => void) {
        super({ maxPayload: MAX_MESSAGE_BYTES, ...options }, callback);
        this.sockets = new Map();
        this.networks = new Map();

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

    /** Public networks as clients see them: no password hash, no member list. */
    public list(): NetworkInfo[] {
        return Array.from(this.networks.values())
            .filter(network => !network.private)
            .map(network => this.info(network));
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
        socket.networks = new Set();

        const existing = this.sockets.get(socket.id);
        if (existing)
        {
            // same id reconnecting: the new socket takes over its memberships
            socket.networks = existing.networks;
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
        for (const id of Array.from(socket.networks))
        {
            this.leave(socket, id);
        }
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
            if (meta.sender !== socket.id) return void this.error(socket, "spoof", "sender does not match the socket id", meta.id);
            if (meta.receiver === SERVER) return void this.handleSignal(socket, message);
            if (meta.type.startsWith("signal.")) return void this.error(socket, "forbidden", "signal messages may only be sent to the server", meta.id);
            if (meta.receiver === BROADCAST) return void this.error(socket, "unsupported", "the server does not broadcast", meta.id);

            if (relay(meta, SERVER) !== "forward") return;

            const target = this.sockets.get(meta.receiver);
            if (!target || target.readyState !== ws.WebSocket.OPEN)
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
            case SignalType.Register: return this.register(socket, payload);
            case SignalType.Update: return this.update(socket, payload, meta.id);
            case SignalType.Unregister: return this.unregister(socket, payload, meta.id);
            case SignalType.List: return this.send(socket, SignalType.Networks, { networks: this.list() });
            case SignalType.Join: return this.join(socket, payload, meta.id);
            case SignalType.Leave: return this.leave(socket, payload.network);
            default: return this.error(socket, "unsupported", `unsupported message: ${meta.type}`, meta.id);
        }
    }

    // signal handlers
    private register(socket: Socket, payload: PayloadMap[SignalType.Register]) {
        const network: Network = {
            id: randomUUID(),
            name: payload.name,
            host: socket.id,
            topology: payload.topology,
            private: !!payload.private,
            size: 1,
            members: [socket.id],
        };
        if (payload.meta) network.meta = payload.meta;
        if (payload.media) network.media = payload.media;
        if (payload.password) network.passwordHash = hash(payload.password);

        this.networks.set(network.id, network);
        socket.networks.add(network.id);
        this.send(socket, SignalType.Registered, { network: this.info(network) });
    }

    private update(socket: Socket, payload: PayloadMap[SignalType.Update], ref: string) {
        const network = this.hosted(socket, payload.network, ref);
        if (!network) return;

        if (payload.name !== undefined) network.name = payload.name;
        if (payload.private !== undefined) network.private = payload.private;
        if (payload.meta !== undefined) network.meta = payload.meta;
        if (payload.media !== undefined) network.media = payload.media;
        if (payload.password !== undefined)
        {
            // an empty password opens the network
            if (payload.password) network.passwordHash = hash(payload.password);
            else delete network.passwordHash;
        }

        this.send(socket, SignalType.Updated, { network: this.info(network) });
    }

    private unregister(socket: Socket, payload: PayloadMap[SignalType.Unregister], ref: string) {
        const network = this.hosted(socket, payload.network, ref);
        if (!network) return;

        this.networks.delete(network.id);
        for (const member of network.members)
        {
            this.sockets.get(member)?.networks.delete(network.id);
        }
    }

    private join(socket: Socket, payload: PayloadMap[SignalType.Join], ref: string) {
        const network = this.networks.get(payload.network);
        if (!network) return void this.error(socket, "not-found", "no such network", ref);

        if (network.passwordHash && (!payload.password || hash(payload.password) !== network.passwordHash))
        {
            return void this.error(socket, "forbidden", "wrong password", ref);
        }

        const members = network.members.filter(member => member !== socket.id);
        const entry = members.length
            ? this.options.pickEntry?.(this.info(network), [...members], socket.id) ?? network.host
            : undefined;

        const target = entry === undefined ? undefined : this.sockets.get(entry);
        if (!entry || !target)
        {
            return void this.send(socket, SignalType.Unreachable, { receiver: entry ?? "", ref });
        }

        if (!network.members.includes(socket.id)) network.members.push(socket.id);
        socket.networks.add(network.id);

        // the password was checked here, it is not passed on
        const join = Message.Create({ type: NetworkType.Join, sender: socket.id, receiver: entry, network: network.id }, payload.profile ? { profile: payload.profile } : {});
        target.send(join.toBinary());
    }

    private leave(socket: Socket, id: string) {
        socket.networks.delete(id);

        const network = this.networks.get(id);
        if (!network) return;

        const index = network.members.indexOf(socket.id);
        if (index < 0) return;
        network.members.splice(index, 1);

        if (network.members.length === 0)
        {
            this.networks.delete(id);
            return;
        }

        if (network.host === socket.id)
        {
            network.host = network.members[0];
            const host = this.sockets.get(network.host);
            if (host) this.send(host, SignalType.Host, { network: this.info(network) });
        }
    }

    // helpers
    private hosted(socket: Socket, id: string, ref: string) {
        const network = this.networks.get(id);
        if (!network)
        {
            this.error(socket, "not-found", "no such network", ref);
            return null;
        }
        if (network.host !== socket.id)
        {
            this.error(socket, "forbidden", "only the host can change a network", ref);
            return null;
        }
        return network;
    }

    private info(network: Network): NetworkInfo {
        const { passwordHash, members, ...info } = network;
        return { ...info, size: members.length };
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
