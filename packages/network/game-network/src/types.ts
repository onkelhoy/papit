import type { MediaPlan, Profile } from "@papit/peer-message";

export type { Profile };

/**
 * Who holds the game when the host drops. Either way the next player in join order steps in, and the
 * owner (the one who made it) gets it back when it returns, e.g. after a reload.
 * - `single`: the stand-in only holds it: no newcomers, and it ends if the owner isn't back in `timing.reconnect`.
 * - `shared`: the stand-in is a full host, the game goes on without the owner.
 */
export type Ownership = "single" | "shared";

export type GameOptions = {
    name: string;
    /** Default `single`. */
    ownership?: Ownership;
    /** Shown in `listGames` (needs `lobby: true`). Private games are joined by code only. */
    public?: boolean;
    /** Checked by the host on join. */
    password?: string;
    /** Max players, the host included. Default 8. */
    max?: number;
    meta?: Record<string, unknown>;
    /** papit media plan, e.g. a lossy channel: `{ channels: { fast: { ordered: false, maxRetransmits: 0 } } }`. */
    media?: MediaPlan;
    /** Reuse a code (a reloaded host does). A new one otherwise. */
    code?: string;
};

/** How a create or join can be watched and called off. */
export type Attempt = {
    /** Called on every try, to show progress. */
    onTrying?: (trying: Trying) => void;
    /** Aborting gives up: the attempt rejects with `GameError("left")`. */
    signal?: AbortSignal;
};

export type JoinOptions = Attempt & {
    password?: string;
    /** ms to keep trying a host that doesn't answer. Default `timing.hostWait`. */
    patience?: number;
};

/** A try that's still going: how many so far, ms left, and what the last one heard. */
export type Trying = { tries: number; left: number; heard: "silent" | "unknown" | "failed" };

export type Player = { id: string; profile: Profile; host: boolean };

/** What the host can change while the game runs. */
export type GameInfo = {
    name: string;
    public: boolean;
    max: number;
    /** Has a password (the password itself stays with the host). */
    password: boolean;
    locked: boolean;
    ownership: Ownership;
    meta: Record<string, unknown>;
};

/** A game as the lobby lists it. */
export type GameListing = GameInfo & { code: string; host: string; players: number };

/** Someone in the lobby. `game` is the code of the game they host. Guests in a game are out of the lobby. */
export type LobbyPlayer = { id: string; profile: Profile; game: string | null };

export type LobbyStatus = "connecting" | "waking" | "ready" | "failed";

/**
 * Why a game ended, or a join failed.
 * - `left`: I left · `host-left`: the host closed it, or never came back
 * - `kicked` · `locked` · `full` · `password` (wrong or missing)
 * - `not-found`: the lobby doesn't know the code · `gone`: the network closed under us
 */
export type EndReason = "left" | "host-left" | "kicked" | "locked" | "full" | "password" | "not-found" | "gone";

export class GameError extends Error {
    constructor(readonly reason: EndReason) {
        super(reason);
        this.name = "GameError";
    }
}
