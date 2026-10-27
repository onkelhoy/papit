import type http from "node:http";
import type * as ws from "ws";
import type { NetworkInfo, PeerId } from "@papit/peer-message";

export interface ServerOptions extends ws.ServerOptions {
    /** Id for a new socket. Defaults to `crypto.randomUUID()`. */
    setClientID?(request: http.IncomingMessage): string;
    /** Peer a `network.join` is forwarded to. `members` excludes the newcomer. Defaults to the host. */
    pickEntry?(network: NetworkInfo, members: PeerId[], newcomer: PeerId): PeerId;
    /** Forwarded (peer → peer) messages per second, with bursts up to the same amount. Default 200. */
    forward_rate?: number;
    heartbeat_interval?: number;
    spam_duration?: number;
    spam_reset?: number;
    strikes?: number;
}

export type Socket = ws.WebSocket & {
    id: PeerId;
    is_alive: boolean;
    strike: number;
    lastmessage: number;
    tokens: number;
    refilled_at: number;
    networks: Set<string>;
}

/** A registered network. The host is a member; `size` is derived from `members`. */
export type Network = NetworkInfo & {
    passwordHash?: string;
    members: PeerId[];
}
