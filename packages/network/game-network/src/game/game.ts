import type { Profile } from "@papit/peer-message";
import type { Network as PeerNetwork } from "@papit/webrtc";

import type { Directory } from "../lobby/directory";
import type { Info, Lobby } from "../lobby/lobby";
import { wait, type Config } from "../settings";
import { GameError, type Attempt, type EndReason, type GameInfo, type GameListing, type GameOptions, type JoinOptions, type Player, type Trying } from "../types";
import { cleanCode, gameId, newCode } from "./code";
import type { Memory } from "./memory";
import { isObject, MSG, PREFIX } from "./protocol";

const DEFAULT_MAX = 8;

/** What the directory keeps for a game: its listing, and how to get in. */
export type GameRecord = GameListing & { invite: Info };

/** What a Game needs from the GameNetwork that makes it. */
export type GameContext = {
    config: Config;
    lobby: Lobby;
    /** Where games are found by code (and listed, with `lobby: true`). */
    games: Directory;
    memory: Memory;
    profile: () => Profile;
};

export type GameEvents = {
    /** Someone was let in. `previous` is their old id when they came back (reload, drop). */
    join: { player: Player; previous?: string };
    leave: { player: Player; reason: "left" | "dropped" | "kicked" };
    /** `info` changed: lock, max, name… */
    update: GameInfo;
    /** Someone else hosts now: the next in line after the host dropped, or the owner back. */
    host: { id: string; previous: string };
    /** A guest lost the game and is finding it again. */
    reconnecting: Trying;
    reconnected: void;
    end: EndReason;
};

export type MessageHandler = (data: any, from: string, type: string) => void;

/**
 * What every player keeps, so whoever steps in can host. Tokens are only known as hashes: a stand-in
 * can tell a returning player (or the owner) by its token, but can't pretend to be them.
 */
type Shared = {
    /** The owner's token hash. */
    owner: string;
    /** The token the game's directory record is written with. */
    publish: string;
    password: string;
    kicked: string[];
    /** token hash → peer id, of everyone let in */
    known: [string, string][];
};

/**
 * One game: a mesh network carried by the lobby. Whoever hosts is the truth for who's in.
 *
 * Everyone gets into the mesh, then the host lets them in with `hello` → `welcome | denied` (see
 * `protocol.ts`). papit's own `accept` would be simpler, but a refused guest timed out instead of failing.
 *
 * - Host: keeps the game findable by its code in the directory, and keeps a lobby (finding it again
 *   when lost). A dropped player keeps their place for `timing.reconnect`, known by their token.
 * - Guest: finds the code in the directory, joins, then leaves the lobby (unless it's the lobby's anchor).
 * - The host drops: the next in join order steps in (`ownership`), and hands it back when the owner returns.
 *   Nobody steps in (all links gone): find the code again for `timing.reconnect`, then `host-left`.
 */
export class Game {
    readonly code: string;
    /** I host now: as the owner, or stepped in. */
    isHost = false;
    /** The host's peer id. */
    host = "";
    info: GameInfo = { name: "", public: false, max: DEFAULT_MAX, password: false, locked: false, ownership: "single", meta: {} };
    /** The papit network, for `media` (channels, streams). Replaced when a guest reconnects. */
    network: PeerNetwork | null = null;
    /** Resolves once the game's network closed after the end. A new join of the same game waits for it. */
    whenClosed: Promise<void> = Promise.resolve();

    /** In join order. Private: a public Map breaks papit's d.ts bundling. */
    private roster = new Map<string, Player>();
    /** My token: proves it's me again after a reload. */
    private token = "";
    /** I made this game (or got it back). */
    private mine = false;
    private ended = false;
    private reconnecting = false;
    /** The host dropped and someone ahead of me in line should step in. */
    private lost: ReturnType<typeof setTimeout> | null = null;
    private events = new Map<string, Set<(detail: any) => void>>();
    private handlers = new Map<string, Set<MessageHandler>>();
    /** Undone when I stop hosting. */
    private hosting: (() => void)[] = [];
    private detach: (() => void) | null = null;
    private offAbort: (() => void) | null = null;
    /** Keeps the memory fresh while in the game, so a reload within `timing.resume` comes back. */
    private alive: ReturnType<typeof setInterval> | undefined;
    private waiting: { resolve: () => void; reject: (error: GameError) => void; timer: ReturnType<typeof setTimeout> } | null = null;
    // the Shared part, kept by everyone
    private owner = "";
    private publish = "";
    private password = "";
    /** Kicked token hashes and peer ids: a new token alone doesn't get them back in. */
    private kicked = new Set<string>();
    private known = new Map<string, string>();
    /** The host's: dropped players' places run out. */
    private dropTimers = new Map<string, ReturnType<typeof setTimeout>>();

    private constructor(private ctx: GameContext, code: string) {
        this.code = code;
    }

    // ------------------------------------------------------------------ making one

    /** Hosts a new game, or with `options.code` (a reload) takes back the one still held by a stand-in. */
    static async host(ctx: GameContext, options: GameOptions, attempt: Attempt = {}) {
        const { config, lobby, memory } = ctx;
        const code = cleanCode(options.code) || newCode();
        const game = new Game(ctx, code);
        game.abortable(attempt.signal);
        game.token = memory.save(code, "host", { ...options, code }).token;
        const owner = await hash(game.token);

        try
        {
            await lobby.start();
            if (options.code && await game.reclaim(attempt.onTrying))
            {
                game.keepAlive();
                return game;
            }
            if (game.ended) throw new GameError("left");

            game.mine = true;
            game.owner = owner;
            game.publish = crypto.randomUUID();
            game.password = options.password ?? "";
            game.info = {
                name: options.name,
                public: !!options.public,
                max: options.max ?? DEFAULT_MAX,
                password: !!options.password,
                locked: false,
                ownership: options.ownership ?? "single",
                meta: options.meta ?? {},
            };
            const draft = { name: options.name, topology: "mesh", media: options.media, meta: options.meta };
            game.attach(await lobby.create(draft, {}, gameId(config.app, code)), "");
        }
        catch (error)
        {
            const reason = error instanceof GameError ? error.reason : "gone";
            game.end(reason, { announce: false, forget: reason === "left", quick: true });
            await game.whenClosed;
            throw error;
        }

        game.roster.set(game.me, { id: game.me, profile: ctx.profile(), host: true });
        game.startHosting();
        game.keepAlive();
        return game;
    }

    /** Resolves once the host let us in. Rejects with a `GameError`. */
    static async join(ctx: GameContext, code: string, options: JoinOptions = {}) {
        const clean = cleanCode(code);
        if (!clean) throw new GameError("not-found");
        const game = new Game(ctx, clean);
        game.abortable(options.signal);
        game.token = ctx.memory.save(clean, "guest").token;
        try
        {
            await game.enter(options.patience ?? ctx.config.timing.hostWait, options.password, options.onTrying);
        }
        catch (error)
        {
            const reason = error instanceof GameError ? error.reason : "gone";
            // a wrong password can be tried again, with the same token
            game.end(reason, { announce: false, forget: reason !== "password", quick: true });
            // closed before we say so: a retry right away joins the same network id again
            await game.whenClosed;
            throw error instanceof GameError ? error : new GameError(reason);
        }
        game.keepAlive();
        return game;
    }

    // ------------------------------------------------------------------ using one

    get me() {
        return this.network?.me ?? "";
    }

    get closed() {
        return this.ended;
    }

    /** Players let in, me included, in join order. */
    get players(): Player[] {
        return [...this.roster.values()];
    }

    player(id: string): Player | undefined {
        return this.roster.get(id);
    }

    /** Lifecycle events. Returns the unsubscribe. */
    on<K extends keyof GameEvents>(event: K, handler: (detail: GameEvents[K]) => void) {
        return subscribe(this.events, event, handler);
    }

    /** App messages of `type`, or all of them with `"*"`. Only from players let in. Returns the unsubscribe. */
    onMessage(type: string, handler: MessageHandler) {
        return subscribe(this.handlers, type, handler);
    }

    /** Reliable, to one player. To myself goes straight to my handlers. */
    send(to: string, type: string, data: unknown = {}) {
        if (type.startsWith(PREFIX)) throw new RangeError(`"${PREFIX}" message types are the game's own`);
        if (to === this.me)
        {
            this.deliver(type, structuredClone(data), to);
            return true;
        }
        return this.raw(to, type, data);
    }

    /** Reliable, to every player but me. Returns how many it went to. */
    broadcast(type: string, data: unknown = {}) {
        let sent = 0;
        for (const id of this.roster.keys()) if (id !== this.me && this.send(id, type, data)) sent++;
        return sent;
    }

    /** Leaves for good. The owner of a `single` game leaving ends it for everyone; otherwise the next steps in. */
    leave() {
        if (this.ended) return;
        if (this.isHost && this.mine && this.info.ownership === "single") this.toPlayers(MSG.closed, {});
        else if (!this.isHost && this.host) this.raw(this.host, MSG.bye, {});
        this.end("left");
    }

    /**
     * Drops off without a goodbye, for a page reload: a guest's place is kept, the next in line holds a
     * host's game. The memory stays, so `resume()` gets back in.
     */
    suspend() {
        this.end("gone", { announce: false, forget: false, quick: true });
    }

    // ------------------------------------------------------------------ host controls

    /** No newcomers, and off the lobby list. The dropped can still come back. */
    lock(locked = true) {
        this.change({ locked });
    }

    update(changes: Partial<Pick<GameOptions, "name" | "public" | "max" | "password" | "meta">>) {
        const { password, ...rest } = changes;
        if (password === undefined) return this.change(rest);
        this.password = password;
        this.change({ ...rest, password: !!password });
        this.sync();
    }

    kick(peer: string) {
        if (!this.isHost || peer === this.me) return;
        const known = this.hashOf(peer);
        if (known) this.kicked.add(known);
        this.kicked.add(peer);
        this.raw(peer, MSG.kick, {});
        this.drop(peer, "kicked");
    }

    // ------------------------------------------------------------------ inside

    /** In: no more aborting the attempt, and the memory kept fresh. */
    private keepAlive() {
        this.offAbort?.();
        this.offAbort = null;
        this.ctx.memory.touch();
        this.alive = setInterval(() => this.ctx.memory.touch(), this.ctx.config.timing.hostCheck);
    }

    /** Aborting ends the attempt (or the game) as `left`. */
    private abortable(signal?: AbortSignal) {
        if (!signal) return;
        const abort = () => this.end("left");
        if (signal.aborted) return abort();
        signal.addEventListener("abort", abort, { once: true });
        this.offAbort = () => signal.removeEventListener("abort", abort);
    }

    private emit<K extends keyof GameEvents>(event: K, detail: GameEvents[K]) {
        call(this.events.get(event), handler => handler(detail), event);
    }

    private deliver(type: string, data: unknown, from: string) {
        call(this.handlers.get(type), handler => handler(data, from, type), type);
        call(this.handlers.get("*"), handler => handler(data, from, type), type);
    }

    /** A guest with no direct link to another goes through the host, who has links to all. */
    private raw(to: string, type: string, data: unknown): boolean {
        const network = this.network;
        if (!network || network.closed) return false;
        if (!this.isHost && to !== this.host && !network.linked.has(to))
            return this.raw(this.host, MSG.relay, { to, type, data });
        try
        {
            return network.send(to, type, data);
        }
        catch (error)
        {
            console.warn("game: send failed", type, error);
            return false;
        }
    }

    private toPlayers(type: string, data: unknown, except?: string) {
        for (const id of this.roster.keys()) if (id !== this.me && id !== except) this.raw(id, type, data);
    }

    private change(changes: Partial<GameInfo>) {
        if (!this.isHost || this.ended) return;
        this.info = { ...this.info, ...changes };
        this.toPlayers(MSG.info, this.info);
        this.emit("update", this.info);
        this.ctx.games.republish();
    }

    private shared(): Shared {
        return { owner: this.owner, publish: this.publish, password: this.password, kicked: [...this.kicked], known: [...this.known] };
    }

    private adopt(shared: unknown) {
        if (!isObject(shared)) return;
        const s = shared as Shared;
        this.owner = String(s.owner ?? "");
        this.publish = String(s.publish ?? "");
        this.password = String(s.password ?? "");
        this.kicked = new Set(Array.isArray(s.kicked) ? s.kicked : []);
        this.known = new Map(Array.isArray(s.known) ? s.known : []);
    }

    /** Everyone keeps what a stand-in needs. */
    private sync(except?: string) {
        if (this.isHost) this.toPlayers(MSG.shared, this.shared(), except);
    }

    /** Swaps the roster, telling who came and went. */
    private replace(players: unknown) {
        if (!Array.isArray(players)) return;
        const before = new Map(this.roster);
        this.roster.clear();
        for (const player of players as Player[]) if (isObject(player) && typeof player.id === "string") this.roster.set(player.id, player);
        for (const player of this.roster.values()) if (!before.has(player.id)) this.emit("join", { player });
        for (const player of before.values()) if (!this.roster.has(player.id)) this.emit("leave", { player, reason: "dropped" });
    }

    private record(): GameRecord | null {
        const network = this.network;
        if (this.ended || !this.isHost || !network || network.closed || !this.ctx.lobby.carries(network)) return null;
        const invite = network.invite();
        if (!invite) return null;
        // the host first: guests left the lobby, they can't be reached as entries
        const entries = [this.me, ...(invite.entries ?? []).filter(entry => entry !== this.me)];
        return { ...this.info, code: this.code, host: this.me, players: this.roster.size, invite: { ...invite, entries } };
    }

    private attach(network: PeerNetwork, host: string) {
        this.network = network;
        this.host = host;
        const message = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            const { type, sender } = detail.meta as { type: string; sender: string };
            let data: unknown;
            try { data = detail.parse(); }
            catch { return; }
            if (type.startsWith(PREFIX)) return this.internal(type, isObject(data) ? data : {}, sender);
            if (this.roster.has(sender)) this.deliver(type, data ?? {}, sender);
        };
        const link = (event: Event) => {
            const { peer, open } = (event as CustomEvent).detail as { peer: string; open: boolean };
            if (open || this.network !== network) return;
            if (this.isHost) this.drop(peer, "dropped");
            else if (peer === this.host) this.hostLost();
        };
        const close = () => {
            if (this.network !== network) return;
            // kept in memory: a reload takes it back
            if (this.isHost) this.end("gone", { forget: false });
            else void this.reconnect();
        };
        network.addEventListener("message", message);
        network.addEventListener("link", link);
        network.addEventListener("close", close);
        this.detach = () => {
            network.removeEventListener("message", message);
            network.removeEventListener("link", link);
            network.removeEventListener("close", close);
        };
    }

    private internal(type: string, data: Record<string, unknown>, sender: string) {
        if (type === MSG.host) return this.takeHost(data, sender);
        if (this.isHost) return void this.hostTake(type, data, sender);
        if (sender === this.host) this.guestTake(type, data, sender);
    }

    // ------------------------------------------------------------------ hosting

    private startHosting() {
        const { config, lobby, games } = this.ctx;
        this.isHost = true;
        this.host = this.me;
        const listed = () => config.lobby && this.info.public && !this.info.locked && !this.standingIn;
        this.hosting.push(games.publish(this.code, this.publish, () => this.record(), listed));
        // the host keeps a lobby: it's how newcomers and the dropped find the game
        const timer = setInterval(() => lobby.check(), config.timing.hostCheck);
        this.hosting.push(() => clearInterval(timer));
        void lobby.start().catch(() => undefined);
    }

    private stopHosting() {
        for (const stop of this.hosting.splice(0)) stop();
        this.isHost = false;
    }

    /** Holding a `single` game for its owner: nobody new gets in. */
    private get standingIn() {
        return this.isHost && !this.mine && this.info.ownership === "single";
    }

    private hostTake(type: string, data: Record<string, unknown>, sender: string) {
        switch (type)
        {
            case MSG.hello: return void this.hello(data, sender);
            case MSG.bye: return this.drop(sender, "left");
            case MSG.relay: {
                const { to, type: inner } = data;
                if (!this.roster.has(sender) || typeof to !== "string" || typeof inner !== "string" || to === sender || inner.startsWith(PREFIX)) return;
                if (to === this.me) return this.deliver(inner, data.data ?? {}, sender);
                this.raw(to, MSG.relayed, { from: sender, type: inner, data: data.data });
                return;
            }
        }
    }

    private hashOf(peer: string) {
        for (const [known, id] of this.known) if (id === peer) return known;
        return undefined;
    }

    private async hello(data: Record<string, unknown>, sender: string) {
        const token = typeof data.token === "string" ? data.token.slice(0, 64) : "";
        if (!token || sender === this.me) return;
        const known = await hash(token);
        if (this.ended || !this.isHost) return;
        const deny = (reason: EndReason) => void this.raw(sender, MSG.denied, { reason });
        if (this.kicked.has(known) || this.kicked.has(sender)) return deny("kicked");
        const profile = isObject(data.profile) ? data.profile : {};
        if (known === this.owner && !this.mine) return this.handOver(sender, profile);

        // back after a drop or a reload: their place is kept, no lock, max or password for them
        const previous = this.known.get(known);
        if (previous === undefined)
        {
            if (this.standingIn || this.info.locked) return deny("locked");
            if (this.roster.size >= this.info.max) return deny("full");
            if (this.password && data.password !== this.password) return deny("password");
        }
        clearTimeout(this.dropTimers.get(known));
        this.dropTimers.delete(known);
        if (previous && previous !== sender) this.roster.delete(previous);

        this.known.set(known, sender);
        const player: Player = { id: sender, profile, host: false };
        this.roster.set(sender, player);
        this.raw(sender, MSG.welcome, { players: this.players, info: this.info, shared: this.shared() });
        this.toPlayers(MSG.joined, { player, previous }, sender);
        this.sync(sender);
        this.emit("join", { player, previous });
        this.ctx.games.republish();
    }

    private drop(peer: string, reason: "left" | "dropped" | "kicked") {
        const player = this.roster.get(peer);
        if (!player || peer === this.me) return;
        this.roster.delete(peer);
        const known = this.hashOf(peer);
        if (known)
        {
            if (reason !== "dropped") this.known.delete(known);
            else this.dropTimers.set(known, setTimeout(() => {
                this.dropTimers.delete(known);
                this.known.delete(known);
                this.sync();
            }, this.ctx.config.timing.reconnect));
        }
        this.toPlayers(MSG.left, { id: peer, reason });
        this.sync();
        this.emit("leave", { player, reason });
        this.ctx.games.republish();
    }

    /** I stood in, the owner is back: it hosts again, first in line. */
    private handOver(owner: string, profile: Profile) {
        const others = this.players.filter(player => player.id !== owner).map(player => ({ ...player, host: false }));
        this.roster = new Map([[owner, { id: owner, profile, host: true }], ...others.map(player => [player.id, player] as const)]);
        this.raw(owner, MSG.handover, { players: this.players, info: this.info, shared: this.shared() });
        this.toPlayers(MSG.host, { id: owner, players: this.players }, owner);
        this.stopHosting();
        this.host = owner;
        this.emit("host", { id: owner, previous: this.me });
    }

    // ------------------------------------------------------------------ the host drops

    /** The host's link closed. The next in line I can still reach steps in; is it me? */
    private hostLost() {
        if (this.ended || this.lost || this.reconnecting || this.waiting || !this.network) return;
        const old = this.host;
        const player = this.roster.get(old);
        this.roster.delete(old);
        if (player) this.emit("leave", { player, reason: "dropped" });

        const network = this.network;
        const line = [...this.roster.keys()].filter(id => id === this.me || network.linked.has(id));
        if (line[0] === this.me) return this.stepIn(old);
        // someone ahead of me should say "I host now"; nobody does: find the game the long way
        this.lost = setTimeout(() => {
            this.lost = null;
            void this.reconnect();
        }, this.ctx.config.timing.welcome);
    }

    private stepIn(previous: string) {
        for (const player of this.roster.values()) player.host = player.id === this.me;
        this.startHosting();
        this.toPlayers(MSG.host, { id: this.me, players: this.players });
        this.emit("host", { id: this.me, previous });
        if (this.info.ownership !== "single") return;
        // holding it for the owner, for so long
        const timer = setTimeout(() => {
            if (!this.standingIn) return;
            this.toPlayers(MSG.closed, {});
            this.end("host-left");
        }, this.ctx.config.timing.reconnect);
        this.hosting.push(() => clearTimeout(timer));
    }

    /** "I host now": from the next in line, or a stand-in handing back to the owner. */
    private takeHost(data: Record<string, unknown>, sender: string) {
        const id = data.id;
        if (typeof id !== "string" || this.isHost || id === this.host) return;
        // a claim for itself, from a player (it can come before I notice the host is gone), or the host handing over
        if (!(id === sender && this.roster.has(sender)) && sender !== this.host) return;
        if (this.lost) clearTimeout(this.lost);
        this.lost = null;
        const previous = this.host;
        this.host = id;
        this.replace(data.players);
        this.emit("host", { id, previous });
    }

    // ------------------------------------------------------------------ the guest's side

    private guestTake(type: string, data: Record<string, unknown>, sender: string) {
        switch (type)
        {
            case MSG.welcome:
            case MSG.handover: {
                this.roster.clear();
                for (const player of Array.isArray(data.players) ? data.players : []) if (isObject(player) && typeof player.id === "string") this.roster.set(player.id, player as Player);
                if (isObject(data.info)) this.info = data.info as GameInfo;
                this.adopt(data.shared);
                this.settle()?.resolve();
                if (type === MSG.handover)
                {
                    // the owner, back
                    this.mine = true;
                    this.startHosting();
                    this.emit("host", { id: this.me, previous: sender });
                    return;
                }
                this.ctx.memory.touch();
                // in a game the lobby is only for finding games: leave it, unless it needs me for its socket
                if (this.ctx.lobby.ready && !this.ctx.lobby.anchored) this.ctx.lobby.park();
                return;
            }
            case MSG.denied: {
                const reason = (["kicked", "locked", "full", "password"] as const).find(r => r === data.reason) ?? "locked";
                const waiting = this.settle();
                return waiting ? waiting.reject(new GameError(reason)) : this.end(reason);
            }
            case MSG.joined: {
                const player = data.player as Player;
                if (!isObject(player) || typeof player.id !== "string") return;
                const previous = typeof data.previous === "string" ? data.previous : undefined;
                if (previous && previous !== player.id) this.roster.delete(previous);
                this.roster.set(player.id, player);
                return this.emit("join", { player, previous });
            }
            case MSG.left: {
                const player = typeof data.id === "string" ? this.roster.get(data.id) : undefined;
                if (!player) return;
                this.roster.delete(player.id);
                return this.emit("leave", { player, reason: data.reason === "kicked" || data.reason === "dropped" ? data.reason : "left" });
            }
            case MSG.info: {
                this.info = data as GameInfo;
                return this.emit("update", this.info);
            }
            case MSG.shared: return this.adopt(data);
            case MSG.kick: return this.end("kicked");
            case MSG.closed: return this.end("host-left");
            case MSG.relayed: {
                const { from, type: inner } = data;
                if (typeof from === "string" && typeof inner === "string" && !inner.startsWith(PREFIX) && this.roster.has(from))
                    this.deliver(inner, data.data ?? {}, from);
                return;
            }
        }
    }

    /**
     * The owner after a reload: is the game still held by someone? Then join it and get it handed back.
     * False only when the directory clearly knows nothing of the code (for `timing.unknownFor`): then a
     * fresh game under the same code is safe. Silence is not enough, that would make a second game.
     */
    private async reclaim(onTrying?: (trying: Trying) => void) {
        const { lobby, games, config: { timing } } = this.ctx;
        const until = Date.now() + timing.reconnect;
        let tries = 0;
        let unknownSince = 0;
        let heard: Trying["heard"] = "silent";
        while (!this.ended && Date.now() < until)
        {
            if (tries++) await wait(timing.joinGap);
            onTrying?.({ tries, left: Math.max(0, until - Date.now()), heard });
            const found = await games.find<GameRecord>(this.code);
            if (this.ended) break;
            if (found === "unknown")
            {
                heard = "unknown";
                unknownSince ||= Date.now();
                if (Date.now() - unknownSince >= timing.unknownFor) return false;
                continue;
            }
            unknownSince = 0;
            heard = "silent";
            if (found === "silent") continue;
            // right after my reload the record can still name my old self, until the stand-in's write lands
            let network: PeerNetwork;
            try { network = await lobby.join(found.record.invite, { profile: this.ctx.profile() }); }
            catch { heard = "failed"; continue; }
            this.attach(network, found.record.host);
            try
            {
                await this.greet();
                return true;
            }
            catch
            {
                heard = "failed";
                this.detach?.();
                this.detach = null;
                this.network = null;
                network.leave();
                await closed(network);
            }
        }
        throw new GameError(this.ended ? "left" : "gone");
    }

    /** Finds the host, joins its network and waits for the welcome, until `patience` runs out. */
    private async enter(patience: number, password?: string, onTrying?: (trying: Trying) => void) {
        const until = Date.now() + patience;
        while (true)
        {
            const found = await this.find(until, onTrying);
            this.attach(found.network, found.host);
            try
            {
                return await this.greet(password);
            }
            catch (error)
            {
                // no welcome: the host may be reloading, try the whole way again
                if (!(error instanceof GameError) || error.reason !== "gone" || this.ended || Date.now() > until) throw error;
                this.detach?.();
                this.detach = null;
                this.network = null;
                found.network.leave();
            }
        }
    }

    private greet(password?: string) {
        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.waiting = null;
                reject(new GameError("gone"));
            }, this.ctx.config.timing.welcome);
            this.waiting = { resolve, reject, timer };
            this.raw(this.host, MSG.hello, { profile: this.ctx.profile(), password, token: this.token });
        });
    }

    private settle() {
        const waiting = this.waiting;
        this.waiting = null;
        if (waiting) clearTimeout(waiting.timer);
        return waiting;
    }

    /**
     * Asks the directory who hosts the code, and joins. A host who just sent the link is often in
     * another app with the tab frozen, so silence is tried until `until`. A lobby that knows nothing of
     * the code for `timing.unknownFor` means the game is gone.
     */
    private async find(until: number, onTrying?: (trying: Trying) => void): Promise<{ network: PeerNetwork; host: string }> {
        const { lobby, games, config: { timing } } = this.ctx;
        let tries = 0;
        let unknownSince = 0;
        let lobbyId: string | null = null;
        let heard: Trying["heard"] = "silent";
        const say = () => onTrying?.({ tries, left: Math.max(0, until - Date.now()), heard });

        while (!this.ended && Date.now() < until)
        {
            tries++;
            say();
            // a parked or lost lobby is found again first, it can take a while on a sleeping server
            const ok = await Promise.race([lobby.start().then(() => true, () => false), wait(Math.max(0, until - Date.now())).then(() => false)]);
            if (this.ended) break;
            if (!ok) continue;

            const found = await games.find<GameRecord>(this.code);
            if (this.ended) break;
            // a lobby that changed (new, merged) may not have heard from the host yet: count from now
            if (lobby.id !== lobbyId) unknownSince = 0;
            lobbyId = lobby.id;

            if (found === "unknown")
            {
                unknownSince ||= Date.now();
                heard = "unknown";
                if (Date.now() - unknownSince >= timing.unknownFor) throw new GameError("not-found");
            }
            else if (found === "silent") heard = "silent";
            else
            {
                unknownSince = 0;
                try
                {
                    const network = await lobby.join(found.record.invite, { profile: this.ctx.profile() });
                    if (!this.ended) return { network, host: found.record.host };
                    network.leave();
                    break;
                }
                catch (error)
                {
                    console.warn("game: could not join", error);
                    heard = "failed";
                }
            }
            say();
            await wait(timing.joinGap);
        }
        throw new GameError(this.ended ? "left" : "gone");
    }

    /** Lost the game from here (all links gone, nobody stepped in): find it again for a while. */
    private async reconnect() {
        if (this.ended || this.reconnecting || this.waiting || this.isHost) return;
        this.reconnecting = true;
        const old = this.network;
        this.detach?.();
        this.detach = null;
        this.network = null;
        old?.leave();
        try
        {
            await this.enter(this.ctx.config.timing.reconnect, undefined, trying => this.emit("reconnecting", trying));
            this.reconnecting = false;
            this.emit("reconnected", undefined);
        }
        catch (error)
        {
            this.reconnecting = false;
            const reason = error instanceof GameError ? error.reason : "gone";
            this.end(reason === "gone" || reason === "not-found" ? "host-left" : reason);
        }
    }

    // ------------------------------------------------------------------ the end

    private end(reason: EndReason, { announce = true, forget = true, quick = false } = {}) {
        if (this.ended) return;
        this.ended = true;
        this.stopHosting();
        clearInterval(this.alive);
        this.offAbort?.();
        if (this.lost) clearTimeout(this.lost);
        for (const timer of this.dropTimers.values()) clearTimeout(timer);
        this.settle()?.reject(new GameError(reason));
        this.detach?.();
        const network = this.network;
        if (network && !network.closed)
        {
            // a moment for a goodbye to go out; a page going away has no moment
            if (quick) network.leave();
            else setTimeout(() => network.leave(), 100);
            this.whenClosed = closed(network);
        }
        if (forget) this.ctx.memory.clear();
        if (announce) this.emit("end", reason);
    }
}

/** First 32 hex digits of SHA-256: tokens are only ever shared as this. */
async function hash(text: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** Resolves once `network` closed, or after 1.5 s. */
function closed(network: PeerNetwork | null) {
    if (!network || network.closed) return Promise.resolve();
    return Promise.race([new Promise<void>(resolve => network.addEventListener("close", () => resolve(), { once: true })), wait(1500)]);
}

function subscribe<T>(map: Map<string, Set<T>>, key: string, handler: T) {
    const set = map.get(key) ?? new Set<T>();
    set.add(handler);
    map.set(key, set);
    return () => { set.delete(handler); };
}

function call<T>(set: Set<T> | undefined, run: (handler: T) => void, label: string) {
    for (const handler of [...(set ?? [])])
    {
        try { run(handler); }
        catch (error) { console.error(`game: "${label}" handler`, error); }
    }
}
