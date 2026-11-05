import { SERVER } from "./constants";
import { Message, uuid } from "./component";
import { NetworkType, SignalType } from "./types";
import type { NetworkInfo, PayloadMap, PeerId } from "./types";

/** A message the caller must deliver: `message` goes to `to`. Server messages have `sender: SERVER`. */
export type Reply = { to: PeerId; message: Message };

/** What the registry keeps per network. `anchors` are the peers keeping a socket, in join order; `members` also holds peers that joined through `join`. */
export type RegisteredNetwork = Omit<NetworkInfo, "size" | "anchors" | "entries"> & {
    anchors: PeerId[];
    members: PeerId[];
    /** Wanted number of anchors, when the creator asked for more than the one that registers. */
    target?: number;
    keyHash?: string;
    passwordHash?: string;
};

export type RegistryOptions = {
    /** Hashes a password before it is stored and compared. Default: identity, so pass a real hash when networks have passwords. */
    hash?: (secret: string) => string;
    /** Peer a `network.join` is forwarded to. `members` excludes the newcomer. Default: the first anchor (join order). */
    pickEntry?(network: NetworkInfo, members: PeerId[], newcomer: PeerId): PeerId;
    /** False for a peer nothing can be sent to right now (gone, closing). Default: always true. */
    reachable?(peer: PeerId): boolean;
    /** Ids for new networks. Default: random uuids. */
    id?: () => string;
}

/**
 * Pure bookkeeping of networks and their anchors, shared by the signal server and any other rendezvous
 * (e.g. a peer that owns a key). It does no I/O: every method returns the messages to deliver.
 * Every method is O(members) of the networks it touches.
 */
export class Registry {
    public networks = new Map<string, RegisteredNetwork>();
    private readonly options: RegistryOptions;

    constructor(options: RegistryOptions = {}) {
        this.options = options;
    }

    /** The network as clients see it: no hashes, `size` counts members. */
    public info(network: RegisteredNetwork): NetworkInfo {
        const { anchors, members, target, keyHash, passwordHash, ...info } = network;
        const result: NetworkInfo = { ...info, size: members.length };
        if (target !== undefined) result.anchors = target;
        return result;
    }

    /** Public networks. */
    public list(): NetworkInfo[] {
        return [...this.networks.values()].filter(network => !network.private).map(network => this.info(network));
    }

    public register(from: PeerId, payload: PayloadMap[SignalType.Register]): Reply[] {
        const network: RegisteredNetwork = {
            id: (this.options.id ?? uuid)(),
            name: payload.name,
            topology: payload.topology,
            private: !!payload.private,
            anchors: [from],
            members: [from],
        };
        if (payload.meta) network.meta = payload.meta;
        if (payload.media) network.media = payload.media;
        if (payload.password) network.passwordHash = this.hash(payload.password);
        if (payload.anchors !== undefined) network.target = payload.anchors;
        if (payload.keyHash) network.keyHash = payload.keyHash;

        this.networks.set(network.id, network);
        return [reply(from, SignalType.Registered, { network: this.info(network) }), ...this.announce(network)];
    }

    public update(from: PeerId, payload: PayloadMap[SignalType.Update], ref: string): Reply[] {
        const network = this.owned(from, payload.network, ref);
        if (Array.isArray(network)) return network;

        if (payload.name !== undefined) network.name = payload.name;
        if (payload.private !== undefined) network.private = payload.private;
        if (payload.meta !== undefined) network.meta = payload.meta;
        if (payload.media !== undefined) network.media = payload.media;
        if (payload.password !== undefined)
        {
            // an empty password opens the network
            if (payload.password) network.passwordHash = this.hash(payload.password);
            else delete network.passwordHash;
        }
        return [reply(from, SignalType.Updated, { network: this.info(network) })];
    }

    public unregister(from: PeerId, payload: PayloadMap[SignalType.Unregister], ref: string): Reply[] {
        const network = this.owned(from, payload.network, ref);
        if (Array.isArray(network)) return network;

        this.networks.delete(network.id);
        return [];
    }

    /** Forwards the join to the entry and counts the newcomer as a member. */
    public join(from: PeerId, payload: PayloadMap[SignalType.Join], ref: string): Reply[] {
        const network = this.networks.get(payload.network);
        if (!network) return [failure(from, "not-found", "no such network", ref)];

        // a part of this very network heals a split: its key proves membership
        const healing = !!payload.merge?.keyHash && payload.merge.network.id === network.id && payload.merge.keyHash === network.keyHash;
        if (!healing && network.passwordHash && (!payload.password || this.hash(payload.password) !== network.passwordHash))
        {
            return [failure(from, "forbidden", "wrong password", ref)];
        }

        const members = network.members.filter(member => member !== from);
        const entry = members.length
            ? this.options.pickEntry?.(this.info(network), [...members], from) ?? network.anchors.find(anchor => anchor !== from)
            : undefined;

        if (!entry || this.options.reachable?.(entry) === false)
        {
            return [reply(from, SignalType.Unreachable, { receiver: entry ?? "", ref })];
        }

        if (!payload.merge && !network.members.includes(from)) network.members.push(from);

        // the password was checked here, it is not passed on
        const { profile, merge } = payload;
        const join = Message.Create({ type: NetworkType.Join, sender: from, receiver: entry, network: network.id }, { ...(profile ? { profile } : {}), ...(merge ? { merge } : {}) });
        return [{ to: entry, message: join }];
    }

    /**
     * `payload.peer` becomes an anchor of `payload.network`, or the registry re-creates the network it forgot.
     * An existing network answers `existed: true` with its lowest other anchor as `entry`, whether or not there was room.
     */
    public anchor(from: PeerId, payload: PayloadMap[SignalType.Anchor], ref: string): Reply[] {
        const { network: info, keyHash, peer } = payload;
        const network = this.networks.get(info.id);

        if (!network)
        {
            const { size, anchors, entries, ...rest } = info;
            const created: RegisteredNetwork = { ...rest, anchors: [peer], members: [peer], keyHash };
            if (anchors !== undefined) created.target = anchors;
            this.networks.set(created.id, created);
            return [reply(from, SignalType.Anchored, { network: created.id, ok: true, existed: false }), ...this.announce(created)];
        }

        if (network.keyHash !== undefined && network.keyHash !== keyHash) return [failure(from, "forbidden", "wrong key", ref)];

        const entry = network.anchors.find(anchor => anchor !== peer);
        const answer = (ok: boolean) => reply(from, SignalType.Anchored, { network: network.id, ok, existed: true, ...(entry ? { entry } : {}) });

        if (network.anchors.includes(peer)) return [answer(true)];
        if (network.anchors.length >= (network.target ?? 1)) return [answer(false)];

        network.anchors.push(peer);
        if (!network.members.includes(peer)) network.members.push(peer);
        if (network.keyHash === undefined) network.keyHash = keyHash;
        return [answer(true), ...this.announce(network)];
    }

    public unanchor(from: PeerId, payload: PayloadMap[SignalType.Unanchor]): Reply[] {
        const network = this.networks.get(payload.network);
        if (!network || !network.anchors.includes(from)) return [];

        network.anchors.splice(network.anchors.indexOf(from), 1);
        return this.settle(network);
    }

    /** `from` leaves one network. The network goes when its last anchor does. */
    public leave(from: PeerId, id: string): Reply[] {
        const network = this.networks.get(id);
        if (!network) return [];

        const index = network.members.indexOf(from);
        if (index < 0) return [];
        network.members.splice(index, 1);
        if (!network.anchors.includes(from)) return [];

        network.anchors.splice(network.anchors.indexOf(from), 1);
        return this.settle(network);
    }

    /** `from` is gone (its socket closed): it leaves every network. */
    public drop(from: PeerId): Reply[] {
        const out: Reply[] = [];
        for (const network of [...this.networks.values()]) out.push(...this.leave(from, network.id));
        return out;
    }

    // helpers
    private hash(secret: string) {
        return this.options.hash ? this.options.hash(secret) : secret;
    }

    /** The anchors changed: tell the rest, or delete the network when none is left. */
    private settle(network: RegisteredNetwork): Reply[] {
        if (network.anchors.length === 0)
        {
            this.networks.delete(network.id);
            return [];
        }
        return this.announce(network);
    }

    private announce(network: RegisteredNetwork): Reply[] {
        const payload = { network: network.id, anchors: [...network.anchors], target: network.target ?? 1 };
        return network.anchors.map(anchor => reply(anchor, SignalType.Anchors, payload));
    }

    /** The network when `from` anchors it, else the error replies. */
    private owned(from: PeerId, id: string, ref: string): RegisteredNetwork | Reply[] {
        const network = this.networks.get(id);
        if (!network) return [failure(from, "not-found", "no such network", ref)];
        if (!network.anchors.includes(from)) return [failure(from, "forbidden", "only an anchor can change a network", ref)];
        return network;
    }
}

function reply<T extends keyof PayloadMap>(to: PeerId, type: T, payload: PayloadMap[T]): Reply {
    return { to, message: Message.Create({ type, sender: SERVER, receiver: to }, payload) };
}

function failure(to: PeerId, code: string, message: string, ref?: string): Reply {
    return reply(to, SignalType.Error, ref ? { code, message, ref } : { code, message });
}
