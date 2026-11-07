import type { Network as PeerNetwork } from "@papit/webrtc";

import type { Timing } from "../settings";
import type { Lobby } from "./lobby";

/** What a `find` learned: the record, `unknown` (the owner has none), or `silent` (no answer came). */
export type Found<T> = { record: T; time: number } | "unknown" | "silent";

type Stored = { record: unknown; token: string; until: number; time: number };
type Asked = { resolve: (answer: Record<string, unknown> | null) => void; timer: ReturnType<typeof setTimeout> };
type Published = { token: string; record: () => unknown; listed: () => boolean; wasListed: boolean; timer: ReturnType<typeof setInterval> };

/** Most records one key holds, so a peer can't fill an owner's memory. The index holds every listed one. */
export const MAX_RECORDS = 500;

/**
 * A small lookup table kept in the lobby's chord ring, no server involved. Each record lives at whoever owns
 * its key; the publisher writes it every `timing.publish`, the owner forgets it `timing.expire` after the last write. Only the
 * token that wrote a record can replace it while it's fresh.
 *
 * A record can also be `listed`: then it's written to one more key, the index, whose owner can answer
 * `list()` with all of them. Knows nothing about games.
 */
export class Directory {
    /** key → name → record, for the keys I own. */
    private store = new Map<string, Map<string, Stored>>();
    private asked = new Map<string, Asked>();
    private published = new Map<string, Published>();
    private settling: ReturnType<typeof setTimeout> | undefined;
    private closed = false;

    constructor(private lobby: Lobby, private prefix: string, private timing: Pick<Timing, "publish" | "expire" | "answer">) {
        lobby.onNetwork(network => this.listen(network));
        // after a merge the keys have new owners: write again soon, once the ring has settled a little
        lobby.onMerged(() => {
            this.republish();
            clearTimeout(this.settling);
            this.settling = setTimeout(() => this.republish(), 1500);
        });
    }

    /**
     * Keeps `record()` findable under `name` until the returned stop. Null from `record` skips a write.
     * `listed()` true puts it in `list()` too.
     */
    publish(name: string, token: string, record: () => unknown, listed: () => boolean = () => false) {
        this.unpublish(name);
        if (this.closed) return () => undefined;
        const entry: Published = { token, record, listed, wasListed: false, timer: setInterval(() => this.write(name, entry), this.timing.publish) };
        this.published.set(name, entry);
        this.write(name, entry);
        return () => this.unpublish(name);
    }

    /** Writes everything now, after a new lobby or a change for example. */
    republish() {
        if (this.closed) return;
        for (const [name, entry] of this.published) this.write(name, entry);
    }

    unpublish(name: string) {
        const entry = this.published.get(name);
        if (!entry) return;
        clearInterval(entry.timer);
        this.published.delete(name);
        this.send(this.key(name), "drop", { name, token: entry.token });
        this.send(this.index, "drop", { name, token: entry.token });
    }

    /** Stops every publish (with a drop), answers open questions with silence and forgets the store. */
    close() {
        if (this.closed) return;
        for (const name of [...this.published.keys()]) this.unpublish(name);
        this.closed = true;
        clearTimeout(this.settling);
        for (const asked of this.asked.values())
        {
            clearTimeout(asked.timer);
            asked.resolve(null);
        }
        this.asked.clear();
        this.store.clear();
    }

    /** Asks the owner of `name` for its record. */
    async find<T>(name: string): Promise<Found<T>> {
        const answer = await this.ask(this.key(name), { name });
        if (!answer) return "silent";
        return answer.record == null ? "unknown" : { record: answer.record as T, time: Number(answer.time) || 0 };
    }

    /** Every listed record, empty when the index owner doesn't answer. */
    async list<T>(): Promise<T[]> {
        const answer = await this.ask(this.index, {});
        return Array.isArray(answer?.records) ? answer.records as T[] : [];
    }

    private get index() {
        return `${this.prefix}:*`;
    }

    private key(name: string) {
        return `${this.prefix}:${name}`;
    }

    private write(name: string, entry: Published) {
        const record = entry.record();
        if (record == null) return;
        const { token } = entry;
        this.send(this.key(name), "put", { name, token, record });
        const listed = entry.listed();
        if (listed) this.send(this.index, "put", { name, token, record });
        else if (entry.wasListed) this.send(this.index, "drop", { name, token });
        entry.wasListed = listed;
    }

    private send(key: string, type: string, payload: Record<string, unknown>) {
        const network = this.lobby.network;
        if (!network || network.closed) return false;
        try
        {
            network.sendKey(key, `${this.prefix}.${type}`, { ...payload, key });
            return true;
        }
        catch (error)
        {
            console.warn(`directory: ${type} failed`, error);
            return false;
        }
    }

    private ask(key: string, payload: Record<string, unknown>) {
        if (this.closed) return Promise.resolve(null);
        const ask = crypto.randomUUID().slice(0, 12);
        return new Promise<Record<string, unknown> | null>(resolve => {
            const timer = setTimeout(() => {
                this.asked.delete(ask);
                resolve(null);
            }, this.timing.answer);
            this.asked.set(ask, { resolve, timer });
            if (!this.send(key, "find", { ...payload, ask }))
            {
                clearTimeout(timer);
                this.asked.delete(ask);
                resolve(null);
            }
        });
    }

    private listen(network: PeerNetwork) {
        // a new lobby: what I publish goes to its owners at once, not in 5 s
        queueMicrotask(() => this.republish());
        network.addEventListener("message", event => {
            if (this.closed) return;
            const message = (event as CustomEvent).detail;
            const { type, sender } = message.meta as { type: string; sender: string };
            if (!type.startsWith(`${this.prefix}.`)) return;
            let payload: unknown;
            try { payload = message.parse(); }
            catch { return; }
            if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
            this.take(network, type.slice(this.prefix.length + 1), payload as Record<string, unknown>, sender);
        });
    }

    private take(network: PeerNetwork, type: string, payload: Record<string, unknown>, sender: string): void {
        const key = typeof payload.key === "string" && payload.key.startsWith(`${this.prefix}:`) ? payload.key : "";
        const name = typeof payload.name === "string" ? payload.name.slice(0, 64) : "";
        const now = Date.now();
        for (const [k, names] of this.store)
        {
            for (const [n, stored] of names) if (stored.until < now) names.delete(n);
            if (!names.size) this.store.delete(k);
        }

        switch (type)
        {
            case "put": {
                const token = typeof payload.token === "string" ? payload.token : "";
                if (!key || !name || !token) return;
                const names = this.store.get(key) ?? new Map<string, Stored>();
                const old = names.get(name);
                if (old && old.token !== token) return;
                if (!old && names.size >= MAX_RECORDS) return;
                names.set(name, { record: payload.record, token, until: now + this.timing.expire, time: now });
                this.store.set(key, names);
                return;
            }
            case "drop": {
                const names = this.store.get(key);
                if (names && names.get(name)?.token === payload.token) names.delete(name);
                return;
            }
            case "find": {
                if (!key || typeof payload.ask !== "string") return;
                const names = this.store.get(key);
                const answer: Record<string, unknown> = { ask: payload.ask };
                if (name)
                {
                    const stored = names?.get(name);
                    answer.record = stored?.record ?? null;
                    answer.time = stored?.time ?? 0;
                }
                else answer.records = [...(names?.values() ?? [])].map(stored => stored.record);
                if (sender === network.me) return this.take(network, "found", answer, sender);
                try { network.send(sender, `${this.prefix}.found`, answer); }
                catch (error) { console.warn("directory: answer failed", error); }
                return;
            }
            case "found": {
                const asked = typeof payload.ask === "string" ? this.asked.get(payload.ask) : undefined;
                if (!asked) return;
                clearTimeout(asked.timer);
                this.asked.delete(payload.ask as string);
                asked.resolve(payload);
                return;
            }
        }
    }
}
