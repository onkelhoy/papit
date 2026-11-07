import type { Profile } from "@papit/peer-message";

/** Every wait and interval, in ms. */
export type Timing = {
    /** A WebRTC handshake gives up, short so a join that can't connect fails fast. */
    handshake: number;
    /** Joining a listed lobby gives up and makes its own. */
    lobbyJoin: number;
    /** Lobby retries back off from `retryMin` to `retryMax`. */
    retryMin: number;
    retryMax: number;
    /** An anchor's beacons. A part that misses three re-anchors and merges back. */
    beacon: number;
    /** An anchor looks for a lobby to merge into. */
    rescan: number;
    /** After making a lobby: look for one made at the same moment. */
    earlyMerge: number[];

    /** A directory record is written again (owners change as peers come and go). */
    publish: number;
    /** A directory record is forgotten without a write. */
    expire: number;
    /** A directory question waits for its answer. */
    answer: number;

    /** One entry of a game gets to answer a join. */
    entry: number;
    /** A host checks that its lobby is still there. */
    hostCheck: number;
    /** A guest keeps trying a host that doesn't answer (it may be in another app sending the link). */
    hostWait: number;
    /** Between a guest's tries. */
    joinGap: number;
    /** A dropped player keeps their place, and a dropped guest keeps trying. */
    reconnect: number;
    /** The lobby knows nothing of a code for this long: the game is gone. */
    unknownFor: number;
    /** A guest waits for the host's welcome. */
    welcome: number;
    /** After a reload, a game seen less than this long ago is reconnected to (`resume`). Older is forgotten. */
    resume: number;
};

export const DEFAULT_TIMING: Timing = {
    handshake: 6000,
    lobbyJoin: 6000,
    retryMin: 3000,
    retryMax: 30_000,
    beacon: 10_000,
    rescan: 20_000,
    earlyMerge: [1500, 4000, 9000],

    publish: 5000,
    expire: 20_000,
    answer: 4000,

    entry: 5000,
    hostCheck: 5000,
    hostWait: 120_000,
    joinGap: 3000,
    reconnect: 120_000,
    unknownFor: 30_000,
    welcome: 10_000,
    resume: 5 * 60_000,
};

/** What you pass to `new GameNetwork(...)`. Only `signal` and `app` are needed. */
export type Settings = {
    /** The signal server, `ws://` or `wss://`. Its HTTP side (`/health`, `/networks`) is the same host. */
    signal: string | URL;
    /** The name of the one network the signal server sees. Also prefixes game ids and storage keys. */
    app: string;
    /** Lists public games and the players in the lobby (`listGames`, `listPlayers`). Off: games by code only. */
    lobby?: boolean;
    /** Who I am to others (name, colour…). Sent when joining, shown in the lobby. */
    profile?: Profile;
    /** Bump when your messages change, so old clients end up in a lobby of their own. */
    version?: string | number;
    /** STUN/TURN. Defaults to Google's STUN only; add TURN for strict networks. */
    rtc?: RTCConfiguration;
    timing?: Partial<Timing>;
    /** Where the last game is remembered for a reload. Defaults to `sessionStorage`; `null` turns it off. */
    storage?: Storage | null;
};

/** Settings with every default filled in. The one thing passed around inside. */
export type Config = {
    app: string;
    /** `ws://` or `wss://` */
    signal: string;
    /** `http://` or `https://`, no trailing slash */
    http: string;
    lobby: boolean;
    /** What a lobby of this app and version carries in its meta. Lobbies with other meta are left alone. */
    meta: Record<string, unknown>;
    rtc: RTCConfiguration;
    timing: Timing;
    storage: Storage | null;
};

export const DEFAULT_RTC: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export function resolve(settings: Settings): Config {
    if (!settings.app) throw new Error("network: `app` is required");
    const signal = new URL(settings.signal);
    if (signal.protocol !== "ws:" && signal.protocol !== "wss:") throw new Error(`network: \`signal\` must be ws:// or wss://, got ${signal.protocol}`);

    return {
        app: settings.app,
        signal: signal.toString(),
        http: httpOf(signal),
        lobby: settings.lobby ?? false,
        meta: { app: settings.app, v: settings.version ?? 1 },
        rtc: settings.rtc ?? DEFAULT_RTC,
        timing: { ...DEFAULT_TIMING, ...settings.timing },
        storage: settings.storage !== undefined ? settings.storage : globalThis.sessionStorage ?? null,
    };
}

/** `wss://host/path` → `https://host/path` */
function httpOf(signal: URL) {
    const url = new URL(signal);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
}

export const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
