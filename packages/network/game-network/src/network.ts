import type { Client } from "@papit/webrtc";

import { inviteLink, parseInvite } from "./game/code";
import { isObject } from "./game/protocol";
import { Game, type GameContext, type GameRecord } from "./game/game";
import { Memory, type Remembered } from "./game/memory";
import { Directory } from "./lobby/directory";
import { Lobby } from "./lobby/lobby";
import { resolve, type Config, type Settings } from "./settings";
import type { Attempt, GameListing, GameOptions, JoinOptions, LobbyPlayer, LobbyStatus, Profile, Trying } from "./types";

/**
 * Everything a game needs from the network, in one object. See the README.
 *
 * Dispatches `"status"` (`CustomEvent<LobbyStatus>`), `"game"` (`CustomEvent<Game | null>`) and, while
 * `resume` is trying, `"trying"` (`CustomEvent<Trying>`).
 */
export class GameNetwork extends EventTarget {

    readonly config: Config;
    readonly lobby: Lobby;
    /** The game I'm in. */
    game: Game | null = null;
    /** Resolves once we're in a lobby the first time. */
    readonly ready: Promise<void>;

    private profile: Profile;
    private memory: Memory;
    /** Games by code. Listed ones (public, with `lobby: true`) make `listGames`. */
    private games: Directory;
    /** Who's in the lobby, with `lobby: true`. */
    private people: Directory | null = null;
    private ctx: GameContext;
    /** The last game's network closing: the next one waits, a rejoin of the same id would clash. */
    private closing: Promise<void> = Promise.resolve();
    /** The `resume` under way, to `cancel`. */
    private resuming: AbortController | null = null;
    private unhook: () => void;

    constructor(settings: Settings) {
        super();
        this.config = resolve(settings);
        this.profile = settings.profile ?? {};
        this.memory = new Memory(this.config.storage, this.config.app, this.config.timing.resume);

        this.lobby = new Lobby(this.config);
        this.lobby.addEventListener("status", event => {
            this.dispatchEvent(new CustomEvent("status", { detail: (event as CustomEvent).detail }));
        });

        this.games = new Directory(this.lobby, "games", this.config.timing);
        if (this.config.lobby) this.people = new Directory(this.lobby, "players", this.config.timing);
        this.ctx = { config: this.config, lobby: this.lobby, games: this.games, memory: this.memory, profile: () => this.profile };

        this.unhook = this.hookPage();
        this.ready = this.connectLobby();
    }

    get client(): Client {
        return this.lobby.client;
    }

    get status(): LobbyStatus {
        return this.lobby.status;
    }

    /** The code of an invite link in the page's address, or null. */
    static inviteCode(search: string = location.search) {
        return parseInvite(search) || null;
    }

    // ------------------------------------------------------------------ games

    /** Hosts a game. Leaves the one I'm in. */
    async createGame(options: GameOptions, attempt?: Attempt) {
        this.leaveGame();
        await this.closing;
        return this.use(await Game.host(this.ctx, options, attempt));
    }

    /** Joins by code. Leaves the one I'm in. Rejects with a `GameError`, its `reason` says why. */
    async joinGame(code: string, options?: JoinOptions) {
        this.leaveGame();
        await this.closing;
        return this.use(await Game.join(this.ctx, code, options));
    }

    leaveGame() {
        this.game?.leave();
    }

    /** The game this tab was in before a reload, seen less than `timing.resume` ago. */
    get last(): Remembered | null {
        return this.memory.get();
    }

    /** True while `resume` is trying. */
    get reconnecting() {
        return !!this.resuming;
    }

    /**
     * Back into the game of before a reload, as host or guest. Keeps trying for `timing.reconnect`: a
     * host only opens it fresh when nobody holds it any more, never on silence (that would make two).
     * Null when there's nothing to go back to. `cancel()` gives up: rejects with `GameError("left")`.
     */
    async resume(attempt: Pick<Attempt, "onTrying"> = {}) {
        const last = this.memory.get();
        if (!last) return null;
        this.cancel();
        const abort = this.resuming = new AbortController();
        const onTrying = (trying: Trying) => {
            attempt.onTrying?.(trying);
            this.dispatchEvent(new CustomEvent("trying", { detail: trying }));
        };
        try
        {
            if (last.role === "host" && last.options) return await this.createGame({ ...last.options, code: last.code }, { onTrying, signal: abort.signal });
            return await this.joinGame(last.code, { patience: this.config.timing.reconnect, onTrying, signal: abort.signal });
        }
        finally
        {
            if (this.resuming === abort) this.resuming = null;
        }
    }

    /** Stops a `resume` that's still trying, and forgets the game. */
    cancel() {
        this.resuming?.abort();
        this.resuming = null;
    }

    /** The link to share for my game, or for `code`. */
    inviteLink(code = this.game?.code, page?: string) {
        if (!code) throw new Error("network: no game to invite to");
        return inviteLink(code, page);
    }

    // ------------------------------------------------------------------ the lobby (`lobby: true`)

    /** Public games that aren't locked. Empty while we're not in a lobby. */
    async listGames(): Promise<GameListing[]> {
        this.needLobby();
        if (!this.lobby.ready) return [];
        const records = await this.games.list<GameRecord>();
        return records.filter(isListing).map(({ invite, ...listing }) => listing);
    }

    /** Players in the lobby. Hosts stay in it (with their `game`), guests in a game left it. */
    async listPlayers(): Promise<LobbyPlayer[]> {
        this.needLobby();
        if (!this.lobby.ready) return [];
        const records = await this.people!.list<LobbyPlayer>();
        return records.filter(isLobbyPlayer);
    }

    setProfile(profile: Profile) {
        this.profile = profile;
        this.people?.republish();
    }

    /** Leaves everything and closes the socket. */
    close() {
        this.cancel();
        this.leaveGame();
        this.unhook();
        this.games.close();
        this.people?.close();
        this.lobby.close();
    }

    // ------------------------------------------------------------------ inside

    private async connectLobby() {
        if (this.people)
        {
            const people = this.people;
            let published = false;
            // my peer id stays the same in every lobby, so one record does
            this.lobby.onNetwork(network => {
                if (published) return;
                published = true;
                people.publish(network.me, crypto.randomUUID(), (): LobbyPlayer => ({
                    id: network.me,
                    profile: this.profile,
                    game: this.game?.isHost && !this.game.closed ? this.game.code : null,
                }), () => true);
            });
        }
        await this.lobby.start();
    }

    private needLobby() {
        if (!this.config.lobby) throw new Error("network: listing needs `lobby: true`");
    }

    private use(game: Game) {
        this.game = game;
        game.on("end", () => {
            this.closing = game.whenClosed;
            if (this.game !== game) return;
            this.game = null;
            this.dispatchEvent(new CustomEvent("game", { detail: null }));
            // back to the lobby, to be seen and to see games again
            void this.lobby.start().catch(() => undefined);
        });
        this.dispatchEvent(new CustomEvent("game", { detail: game }));
        this.people?.republish();
        return game;
    }

    /** The page's life: a reload drops off quietly (to resume), coming back from the background checks the lobby. */
    private hookPage() {
        if (typeof window === "undefined") return () => undefined;
        const hide = () => this.game?.suspend();
        const show = () => {
            if (document.visibilityState !== "visible") return;
            this.lobby.check();
            this.games.republish();
            this.people?.republish();
        };
        window.addEventListener("pagehide", hide);
        document.addEventListener("visibilitychange", show);
        return () => {
            window.removeEventListener("pagehide", hide);
            document.removeEventListener("visibilitychange", show);
        };
    }
}

// records come from other peers: keep only the ones shaped right
function isListing(record: unknown): record is GameRecord {
    if (!isObject(record)) return false;
    return typeof record.code === "string"
        && typeof record.name === "string"
        && typeof record.host === "string"
        && typeof record.players === "number"
        && typeof record.max === "number";
}

function isLobbyPlayer(record: unknown): record is LobbyPlayer {
    return isObject(record) && typeof record.id === "string" && isObject(record.profile) && (record.game === null || typeof record.game === "string");
}
