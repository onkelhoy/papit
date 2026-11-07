import { Client, ParentBootstrap, type Network as PeerNetwork } from "@papit/webrtc";

import { wait, type Config } from "../settings";
import type { LobbyStatus } from "../types";

/** A network as `GET /networks` and `network.invite()` give it. */
export type Info = NonNullable<ReturnType<PeerNetwork["invite"]>>;

/** One peer keeps a socket to the signal server so newcomers find the lobby; everyone else closes theirs. */
const ANCHORS = 1;
const byId = (a: Info, b: Info) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
/** Every field of `want` is the same in `info.meta`, so an older version's lobby is left alone. */
const metaMatches = (info: Info, want: Record<string, unknown> = {}) =>
    Object.entries(want).every(([key, value]) => (info.meta as Record<string, unknown> | undefined)?.[key] === value);

/**
 * The one public chord network of an app, the only thing the signal server sees. Knows nothing about games.
 *
 * - Found with `GET /networks`, the lowest id wins. None, or a join that fails: create one at once.
 * - A drifted part re-anchors after missing three beacons, so two lobbies get listed. The anchor of each
 *   looks now and then and merges into the lower id.
 * - Games are networks carried by this one (`create`/`join`), the server never sees them, and they
 *   outlive it: a lost lobby only stops newcomers until we're in one again.
 *
 * Dispatches `"status"` (`CustomEvent<LobbyStatus>`).
 */
export class Lobby extends EventTarget {
    readonly client: Client;
    network: PeerNetwork | null = null;
    status: LobbyStatus = "connecting";
    private closed = false;
    private merging = false;
    /** Out of the lobby on purpose (a guest in a game doesn't need it), `start` brings us back. */
    private parked = false;
    private starting: Promise<PeerNetwork> | null = null;
    private timer: ReturnType<typeof setInterval> | undefined;
    /** The games made or joined through us, carried again by each new lobby. */
    private carried = new Set<ParentBootstrap>();
    private watchers: ((network: PeerNetwork) => void)[] = [];
    private mergers: (() => void)[] = [];
    private early: ReturnType<typeof setTimeout>[] = [];

    constructor(private config: Config) {
        super();
        this.client = new Client({ url: config.signal, rtc: config.rtc, handshakeTimeout: config.timing.handshake });
    }

    /** The lobby's id now. It changes when this lobby merges into another. */
    get id() {
        return this.network?.info?.id ?? null;
    }

    get ready() {
        return !!this.network && !this.network.closed;
    }

    /** True when we keep the socket to the signal server: others find the lobby through us. */
    get anchored() {
        return !!this.network?.anchored;
    }

    /** Called with each lobby we get into, the first one and every one after a loss or a park. */
    onNetwork(watch: (network: PeerNetwork) => void) {
        this.watchers.push(watch);
        if (this.ready) watch(this.network!);
        return () => { this.watchers = this.watchers.filter(other => other !== watch); };
    }

    /** Called after our lobby merged into another: keys have new owners. */
    onMerged(merged: () => void) {
        this.mergers.push(merged);
    }

    /** Resolves once we're in a lobby. `prefer` is tried first when it's listed. */
    start(prefer?: string): Promise<PeerNetwork> {
        this.parked = false;
        if (this.ready) return Promise.resolve(this.network!);
        this.starting ??= this.run(prefer).finally(() => { this.starting = null; });
        return this.starting;
    }

    /** Leaves the lobby with a goodbye, games made through it play on. `start` comes back. */
    park() {
        if (this.closed || this.parked) return;
        this.parked = true;
        clearInterval(this.timer);
        const network = this.network;
        this.network = null;
        this.setStatus("connecting");
        network?.leave();
    }

    /** Back from the background: a lobby that died while we were frozen is found again. */
    check() {
        if (this.closed || this.parked || this.starting) return;
        if (!this.ready) void this.start().catch(() => undefined);
        else void this.keepListed();
    }

    /** A network carried by the lobby, made here. The same `id` again makes old invites work again. */
    create(draft: Parameters<Client["create"]>[0], setup: Omit<NonNullable<Parameters<Client["create"]>[1]>, "bootstrap"> = {}, id: string = crypto.randomUUID()) {
        return this.track(new ParentBootstrap(this.need(), id, this.config.timing.entry), bootstrap => this.client.create(draft, { ...setup, bootstrap }));
    }

    /** A network carried by the lobby, joined by its invite. */
    join(invite: Info, request: Parameters<Client["join"]>[1] = {}, setup: Omit<NonNullable<Parameters<Client["join"]>[2]>, "bootstrap"> = {}) {
        return this.track(new ParentBootstrap(this.need(), invite.id, this.config.timing.entry), bootstrap => this.client.join(invite, request, { ...setup, bootstrap }));
    }

    /** True when newcomers can reach this network through a lobby now. */
    carries(network: PeerNetwork) {
        return [...this.carried].some(game => game.id === network.info?.id && game.carried);
    }

    /** Is our lobby still listed? If not, become its anchor now, so a code naming it still works. */
    async keepListed() {
        const network = this.network;
        if (!network || network.anchored || this.closed) return;
        const listed = await this.list().catch(() => null);
        if (!listed || listed.some(info => info.id === network.info?.id)) return;
        // the Client opens a socket for it, and it resumes our peer id
        await network.anchor().catch(error => console.warn("lobby: couldn't anchor", error));
    }

    close() {
        this.closed = true;
        clearInterval(this.timer);
        for (const timer of this.early) clearTimeout(timer);
        this.network?.leave();
        this.client.close();
    }

    /** A lobby of this app and version. */
    private ours(info: Info) {
        return info.name === this.config.app && metaMatches(info, this.config.meta);
    }

    private setStatus(status: LobbyStatus) {
        if (status === this.status) return;
        this.status = status;
        this.dispatchEvent(new CustomEvent("status", { detail: status }));
    }

    private async run(prefer?: string) {
        const { timing } = this.config;
        let delay = timing.retryMin;
        while (!this.closed && !this.parked)
        {
            try
            {
                const network = await this.enter(prefer);
                if (this.closed || this.parked)
                {
                    network.leave();
                    break;
                }
                this.network = network;
                this.setStatus("ready");
                network.addEventListener("close", () => this.lost(network));
                clearInterval(this.timer);
                this.timer = setInterval(() => void this.mergeCheck(), timing.rescan);
                // a few of us lost the same lobby at once (its anchor reloaded), each made one: meet soon
                for (const timer of this.early) clearTimeout(timer);
                this.early = network.anchored ? timing.earlyMerge.map(ms => setTimeout(() => void this.mergeCheck(), ms)) : [];
                for (const game of [...this.carried]) game.carry(network);
                for (const watch of [...this.watchers]) watch(network);
                return network;
            }
            catch (error)
            {
                if (this.closed || this.parked) break;
                console.warn("lobby: trying again", error);
                this.setStatus("failed");
                await wait(delay);
                delay = Math.min(delay * 2, timing.retryMax);
            }
        }
        throw new Error("closed");
    }

    private async track(bootstrap: ParentBootstrap, make: (bootstrap: ParentBootstrap) => Promise<PeerNetwork>) {
        this.carried.add(bootstrap);
        try
        {
            const network = await make(bootstrap);
            network.addEventListener("close", () => {
                bootstrap.close();
                this.carried.delete(bootstrap);
            });
            return network;
        }
        catch (error)
        {
            bootstrap.close();
            this.carried.delete(bootstrap);
            throw error;
        }
    }

    private need() {
        if (!this.network || this.network.closed) throw new Error("not in the lobby");
        return this.network;
    }

    private async enter(prefer?: string) {
        await this.wake();
        const { app: name, meta, timing } = this.config;
        const acceptMerge = (info: Info) => this.ours(info);

        const listed = (await this.list()).filter(acceptMerge).sort(byId);
        const first = listed.find(info => info.id === prefer) ?? listed[0];

        if (first)
        {
            try
            {
                return await this.joinQuick(first.id, acceptMerge);
            }
            catch (error)
            {
                // a lobby we can't get into is as good as none, we don't wait for it
                console.warn("lobby: could not join, making a new one", first.id, error);
            }
        }

        return this.client.create({ name, topology: "chord", meta, anchors: ANCHORS, beacon: timing.beacon }, { acceptMerge });
    }

    /** papit gives a join 15 s. A lobby that doesn't answer sooner is as good as gone: close the join under way. */
    private async joinQuick(id: string, acceptMerge: (info: Info) => boolean) {
        const before = new Set(this.client.networks);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("join timed out")), this.config.timing.lobbyJoin);
        });
        try
        {
            return await Promise.race([this.client.join(id, {}, { acceptMerge }), timeout]);
        }
        catch (error)
        {
            for (const network of this.client.networks) if (!before.has(network)) network.close();
            throw error;
        }
        finally
        {
            clearTimeout(timer);
        }
    }

    /** A sleeping free server boots on any request, `/health` is the cheap one. */
    private async wake() {
        for (let i = 0; !this.closed; i++)
        {
            try
            {
                const response = await fetch(`${this.config.http}/health`, { signal: AbortSignal.timeout(10_000) });
                if (response.ok) return;
            }
            catch { /* asleep, or not there */ }
            this.setStatus("waking");
            await wait(Math.min(2000 * (i + 1), 10_000));
        }
    }

    private async list(): Promise<Info[]> {
        const response = await fetch(`${this.config.http}/networks`, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error(`/networks answered ${response.status}`);
        const all = await response.json();
        return Array.isArray(all) ? all : [];
    }

    /** Only an anchor can merge. Two lobbies of this app: the higher id goes into the lower. */
    private async mergeCheck() {
        const network = this.network;
        if (this.merging || this.closed || !network?.anchored || !network.info) return;
        this.merging = true;

        try
        {
            const mine = network.info.id;
            const lower = (await this.list())
                .filter(info => this.ours(info) && info.id < mine)
                .sort(byId)[0];
            if (!lower) return;

            // alone in ours: joining theirs is simpler and surer than a merge
            if (!network.linked.size) return void await this.move(network, lower.id);

            await network.merge(lower.id);
            for (const merged of [...this.mergers]) merged();
            // papit's chord can leave a node out of the ring after a merge (its own successor while
            // linked to others, nobody retries): then it moves over by a plain join
            await wait(4000);
            const ring = network.topology as { successors?: string[] } | undefined;
            if (this.network === network && !network.closed && network.linked.size && ring?.successors?.[0] === network.me)
                await this.move(network, lower.id);
        }
        catch (error)
        {
            console.warn("lobby: merge failed", error);
        }
        finally
        {
            this.merging = false;
        }
    }

    /** Leaves this lobby for another, by a plain join. Games carried by us go along to the new one. */
    private async move(network: PeerNetwork, to: string) {
        this.network = null;
        clearInterval(this.timer);
        network.leave();
        await this.start(to);
        for (const merged of [...this.mergers]) merged();
    }

    /** The lobby closed under us, so find or make one again. */
    private lost(network: PeerNetwork) {
        if (this.closed || this.parked || this.network !== network) return;
        this.network = null;
        this.setStatus("connecting");
        void this.start().catch(() => undefined);
    }
}
