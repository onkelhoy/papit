import type http from "node:http";
import type * as ws from "ws";
import type { NetworkInfo, PeerId, RegisteredNetwork } from "@papit/peer-message";

import type { HostLookup } from "./push/validate";

export interface ServerOptions extends ws.ServerOptions {
    /** Id for a new socket. Defaults to `crypto.randomUUID()`. */
    setClientID?(request: http.IncomingMessage): string;
    /** Peer a `network.join` is forwarded to. `members` excludes the newcomer. Defaults to the first anchor (join order). */
    pickEntry?(network: NetworkInfo, members: PeerId[], newcomer: PeerId): PeerId;
    /** Forwarded (peer → peer) messages per second, with bursts up to the same amount. Default 200. */
    forward_rate?: number;
    heartbeat_interval?: number;
    spam_duration?: number;
    spam_reset?: number;
    strikes?: number;
    /** Signs the resume tokens in `signal.welcome`. Random per process by default, so tokens stop working on restart. */
    secret?: string;
}

export type Socket = ws.WebSocket & {
    id: PeerId;
    is_alive: boolean;
    strike: number;
    lastmessage: number;
    tokens: number;
    refilled_at: number;
    // closing on purpose: nothing is forwarded to it any more
    draining: boolean;
    // the peer id it resumed or anchored under, when that isn't its own id
    peer: PeerId | null;
}

/** A registered network, see `Registry`. */
export type Network = RegisteredNetwork;

/** VAPID key pair, both base64url: the raw public point and the raw private value. */
export type VapidKeys = {
    publicKey: string;
    privateKey: string;
}

/** What `PushSubscription.toJSON()` gives in a browser. */
export type PushSubscription = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

export type PushOptions = {
    /** Seconds the push service keeps a push for an offline browser. Default 60. */
    ttl?: number;
    /** Default `"high"`. */
    urgency?: "very-low" | "low" | "normal" | "high";
    /** Milliseconds to wait for the push service. Default 10000. */
    timeout?: number;
}

/** `gone`: the subscription is dead for good. `failed`: try again later. */
export type PushStatus = "sent" | "gone" | "failed";

export type PushConfig = {
    keys: VapidKeys;
    /** `mailto:` or `https:` contact the push services see. */
    subject: string;
    /** False for throwaway keys: every token dies with this process. */
    persistent: boolean;
    /** Lets pushes reach private addresses, http and local names, for a server inside a private network. Default false. */
    allowPrivate?: boolean;
    /** POST requests per minute per client address, with bursts up to the same amount. 0 means no limit. Default 60. */
    rate?: number;
    /** Proxies in front of the server, so the client address comes from `x-forwarded-for`. Default 0. */
    trustProxy?: number;
    /** Resolves hostnames for the public address check. Defaults to the system's. */
    lookup?: HostLookup;
}
