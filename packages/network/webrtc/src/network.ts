import { BROADCAST, isKeyReceiver, isReserved, Message, NetworkType, PayloadMap, read, relay, Seen, TOPOLOGY_PREFIX, uuid } from "@papit/peer-message";
import type { Meta, NetworkInfo, PeerId, Profile, RelayAction, TopologyConfig } from "@papit/peer-message";

import { Emitter } from "./emitter";
import type { Link } from "./components/link";
import { Media } from "./components/media";
import { fromBase64, toBase64 } from "./base64";
import { realClock } from "./clock";
import { keyReceiver, sha256 } from "./hash";
import { resolveTopology } from "./registry";
import type { AnchorResult, Bootstrap, BootstrapMessage, Carrier, Clock, Connector, Hop, JoinRequest, NetworkDraft, NetworkUpdate, SendOptions, Topology, TopologyContext, TopologyNode } from "./types";

/** How long a back path stays usable after the last message on it. */
export const BACK_TTL = 30_000;
/** Most back paths kept; the oldest goes first. */
export const BACK_LIMIT = 512;
/** How long a join may take, from the request to `ready`. */
export const JOIN_TIMEOUT = 15_000;
/** How long an entry waits for an admitted newcomer's link. */
export const ADMIT_TIMEOUT = 15_000;
/** How long `rtt` waits for a pong. */
export const RTT_TIMEOUT = 5_000;
/** ms between beacons when `info.beacon` isn't set. */
export const DEFAULT_BEACON = 10_000;
/** How long the engine keeps a merge bridge link the topology doesn't want. */
export const MERGE_LIMIT = 30_000;
/** While the network is short of anchors, the lowest anchor asks another peer this often. */
export const RECRUIT_INTERVAL = 1_000;

export type NetworkOptions = {
  me: PeerId;
  info?: NetworkInfo;
  /** A topology, or a name / config. Defaults to `info.topology` (known once admitted). */
  topology?: Topology | string | TopologyConfig;
  bootstrap: Bootstrap;
  connector: Connector;
  clock?: Clock;
  random?: () => number;
  /** Admission hook on the entry. Default: everyone. */
  accept?(peer: PeerId, profile?: Profile): boolean | Promise<boolean>;
  /** Merge hook, for a merge of another network into this one. Default: refuse. */
  acceptMerge?(info: NetworkInfo): boolean | Promise<boolean>;
};

type Attached = {
  link: Link;
  carrier: Carrier;
  /** `topology.link(p, true)` was reported. */
  reported: boolean;
  handleOpen: () => void;
  handleMessage: (event: Event) => void;
  handleClose: () => void;
};

type Joining = {
  id: string;
  /** The admitting entry, once admitted. */
  entry: PeerId | null;
  starting: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
  cancel: () => void;
};

type Merging = {
  /** The network merged into. */
  id: string;
  entry: PeerId | null;
  admit: { network: NetworkInfo; key: string } | null;
  resolve: () => void;
  reject: (error: Error) => void;
  cancel: () => void;
};

type State = "idle" | "joining" | "ready" | "closed";

const toError = (error: unknown) => error instanceof Error ? error : new Error(String(error));

/** JSON with sorted keys, so two equal configs compare equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
  {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const LOCAL: Carrier = { send: () => false };

/**
 * One network on one node. Moves bytes and opens links; the topology decides everything else.
 *
 * @fires message - `CustomEvent<Message>`, an app message for this node
 * @fires link - `CustomEvent<{ peer, open, left }>`, a link opened or closed
 * @fires merged - `CustomEvent<{ bridge, network }>`, a merge bridged to `bridge`; the topology merges from here
 * @fires anchored - `CustomEvent<boolean>`, this node became an anchor (true) or isn't one (false)
 * @fires update - `CustomEvent<NetworkInfo>`, an anchor changed the name, privacy, meta or media plan
 * @fires close - the network closed
 * @fires anchor-request - `CustomEvent<{ from }>`, an anchor asks this node to become one (open a socket, then `anchor()`)
 * @fires error - `CustomEvent<EmitterEvent>`
 * @fires debug - `CustomEvent<EmitterEvent>`
 */
export class Network extends Emitter {
  public readonly me: PeerId;
  public readonly clock: Clock;
  public readonly bootstrap: Bootstrap;
  /** Ids this network accepts in `meta.network`. */
  public readonly ids = new Set<string>();
  public info?: NetworkInfo;
  /** The network key, known to members only. */
  public key?: string;
  /** Resolves once created or joined. */
  public readonly ready: Promise<void>;
  /** This node keeps a socket to the registry for the network. */
  public anchored = false;
  /** The plan from `info.media`, captures, remote streams and plan channels, on this network's WebRTC links. */
  public readonly media: Media;

  private state: State = "idle";
  private readonly connector: Connector;
  private readonly options: NetworkOptions;
  private readonly random: () => number;
  private node: TopologyNode | null = null;
  private context: TopologyContext;
  private config: TopologyConfig = { name: "" };

  // links and wants (rules 2-4)
  private readonly links = new Map<PeerId, Attached>();
  private readonly open = new Set<PeerId>();
  private readonly wanted = new Set<PeerId>();
  private readonly pending = new Set<PeerId>();
  private readonly leaving = new Set<PeerId>();

  // pipeline
  private readonly seen = new Seen();
  private readonly back = new Map<PeerId, { carrier: Carrier; at: number }>();
  private readonly received = new WeakMap<Meta, Message>();

  // join
  private joining: Joining | null = null;
  private entry: PeerId | null = null;
  private entryKept = false;
  private password?: string;
  private readonly admitted = new Map<PeerId, { profile?: Profile; merge?: boolean; cancel: () => void }>();

  // merge (rule 10)
  private merging: Merging | null = null;
  /** Bridge links the engine opened; `kept` once the topology wants them too. */
  private readonly bridges = new Map<PeerId, { kept: boolean }>();
  private settle!: { resolve: () => void; reject: (error: Error) => void };

  // anchors
  private anchors: { anchors: PeerId[]; target: number } | null = null;
  private readonly asked = new Set<PeerId>();
  private recruiting: (() => void) | null = null;

  // split detection
  private lastBeacon = 0;
  private suspecting = false;

  // networks carried over this one
  private readonly rooms = new Map<string, (message: Message, from: PeerId) => void>();

  // timers and pings
  private readonly timers = new Set<unknown>();
  private readonly pings = new Map<number, { resolve: (ms: number) => void; reject: (error: Error) => void; at: number; cancel: () => void }>();
  private ping = 0;

  constructor(options: NetworkOptions) {
    super();

    this.options = options;
    this.me = options.me;
    this.bootstrap = options.bootstrap;
    this.connector = options.connector;
    this.clock = options.clock ?? realClock;
    this.random = options.random ?? Math.random;
    this.context = this.createContext();
    this.media = new Media({ links: () => [...this.open], topology: () => this.node });
    this.media.addEventListener("error", this.handleMediaEvent);
    this.media.addEventListener("debug", this.handleMediaEvent);

    const ready = new Promise<void>((resolve, reject) => this.settle = { resolve, reject });
    ready.catch(() => { });
    this.ready = ready;

    if (options.info)
    {
      this.info = options.info;
      this.ids.add(options.info.id);
      this.syncMedia();
    }

    this.bootstrap.addEventListener("message", this.handleBootstrapMessage);
    this.bootstrap.addEventListener("anchors", this.handleAnchors);
    this.bootstrap.addEventListener("lost", this.handleLost);
  }

  /** The topology's api. */
  get topology(): unknown {
    return this.node?.api;
  }

  /** Open direct links. */
  get linked(): ReadonlySet<PeerId> {
    return this.open;
  }

  get closed() {
    return this.state === "closed";
  }

  /** The network's info with entries a joiner can come in through. */
  invite(): NetworkInfo | null {
    if (!this.info) return null;
    const entries = this.guard("entries", () => this.node?.entries?.()) ?? [...new Set([this.me, ...this.known().slice(0, 2)])];
    return { ...this.info, entries };
  }

  // carrying (any medium a bootstrap builds on this network)
  /** Sends bytes of a network carried over this one to `peer`, as `network.room` for `room`. */
  carry(room: string, peer: PeerId, bytes: Uint8Array) {
    if (this.closed) return false;
    return this.originate(this.system(NetworkType.Room, peer, { room, message: toBase64(bytes) }));
  }

  /** Takes the `network.room` messages for `room`. Returns the release. */
  inbox(room: string, take: (message: Message, from: PeerId) => void) {
    this.rooms.set(room, take);
    return () => {
      if (this.rooms.get(room) === take) this.rooms.delete(room);
    };
  }

  /** What this node's topology knows. */
  known(): readonly PeerId[] {
    return this.guard("known", () => this.node?.known?.()) ?? [...this.open];
  }

  // anchors
  /**
   * Becomes an anchor through the bootstrap, or re-creates the network a registry forgot.
   * Null without a bootstrap that anchors. `ok: false`: the network has enough anchors.
   */
  async anchor(): Promise<AnchorResult | null> {
    if (!this.bootstrap.anchor || this.state !== "ready" || !this.info || !this.key) return null;

    const result = await this.bootstrap.anchor(this.info, await sha256(this.key));
    if (!this.closed) this.setAnchored(result.ok);
    return result;
  }

  private setAnchored(anchored: boolean) {
    if (this.anchored === anchored) return;
    this.anchored = anchored;
    this.emit("anchored", anchored);
  }

  /**
   * Split detection: the first anchor broadcasts `network.beacon` every `beacon` ms. A node that misses
   * three waits a random part of one, then re-anchors; a registry that still knows the network sends it
   * back through a healing merge. Needs a bootstrap that anchors.
   */
  private watchBeacons() {
    const ms = this.info?.beacon ?? DEFAULT_BEACON;
    if (!ms || !this.bootstrap.anchor) return;

    this.lastBeacon = this.clock.now();
    this.every(ms, () => {
      if (this.anchors?.anchors[0] === this.me)
      {
        this.lastBeacon = this.clock.now();
        this.originate(this.system(NetworkType.Beacon, BROADCAST, { anchors: this.anchors.anchors.length }));
        return;
      }
      if (this.suspecting || this.merging || this.clock.now() - this.lastBeacon <= 3 * ms) return;

      this.suspecting = true;
      this.after(this.random() * ms, () => {
        this.suspecting = false;
        if (this.clock.now() - this.lastBeacon <= 3 * ms) return;
        // one try per three missed beacons
        this.lastBeacon = this.clock.now();
        this.recover().catch(error => this.debug("beacon", "recovery failed", { error }));
      });
    });
  }

  /** No beacon: an anchor heals at once; anyone else re-anchors first and heals if the network still exists. */
  private async recover() {
    if (!this.anchored)
    {
      const result = await this.anchor();
      // the registry forgot the network: this part carries it on, with me as its first anchor
      if (!result || !result.existed) return;
      if (result.entry && this.open.has(result.entry)) return;
    }
    this.debug("beacon", "no beacon, healing", { network: this.info?.id });
    await this.heal();
  }

  /** The lowest anchor asks one linked peer at a time, until the target is met. */
  private recruit() {
    this.recruiting?.();
    this.recruiting = null;

    const set = this.anchors;
    if (!set || set.anchors.length >= set.target)
    {
      this.asked.clear();
      return;
    }
    if (set.anchors.reduce((low, id) => id < low ? id : low) !== this.me) return;

    const candidate = [...this.open].filter(peer => !set.anchors.includes(peer) && !this.asked.has(peer)).sort()[0];
    if (candidate)
    {
      this.asked.add(candidate);
      this.originate(this.system(NetworkType.Anchor, candidate, {}));
    }
    // asked everyone: start over next round
    else this.asked.clear();

    this.recruiting = this.after(RECRUIT_INTERVAL, () => this.recruit());
  }

  // lifecycle
  /** Registers a new network through the bootstrap and starts the topology as its first node. */
  async create(draft: NetworkDraft): Promise<NetworkInfo> {
    if (this.state !== "idle") throw new Error(`can't create, the network is ${this.state}`);
    this.state = "joining";

    try
    {
      const key = uuid();
      const info = await this.bootstrap.create(draft, await sha256(key));
      if (this.closed) throw new Error("closed");

      this.info = info;
      this.key = key;
      this.password = draft.password;
      this.syncMedia();
      this.ids.add(info.id);
      // the registry counts the creator as the first anchor
      this.anchored = !!this.bootstrap.anchor;
      this.createNode(info.topology);
      await this.start(null);

      this.state = "ready";
      this.watchBeacons();
      this.settle.resolve();
      return info;
    }
    catch (error)
    {
      if (!this.closed) this.state = "idle";
      const reason = error instanceof Error ? error : new Error(String(error));
      this.settle.reject(reason);
      throw reason;
    }
  }

  /** Joins through the bootstrap. Resolves once admitted, linked to the entry and started. */
  join(network: string | NetworkInfo, request: JoinRequest = {}): Promise<void> {
    if (this.state !== "idle") return Promise.reject(new Error(`can't join, the network is ${this.state}`));

    const id = typeof network === "string" ? network : network.id;
    this.state = "joining";
    this.ids.add(id);
    this.password = request.password;

    return new Promise<void>((resolve, reject) => {
      const cancel = this.after(JOIN_TIMEOUT, () => this.failJoin(new Error("join timed out")));
      this.joining = { id, entry: null, starting: false, resolve, reject, cancel };
      this.bootstrap.join(network, request).catch(error => this.failJoin(error instanceof Error ? error : new Error(String(error))));
    });
  }

  /**
   * Merges this network into `target` (rule 10). Anchors only. Resolves once the bridge link is open
   * and both ends handed it to their topology; every node here then adopts the target's identity.
   */
  async merge(target: string, password?: string): Promise<void> {
    if (this.state !== "ready" || !this.info || !this.key) throw new Error(`can't merge, the network is ${this.state}`);
    if (!this.anchored) throw new Error("only an anchor can merge");
    return this.requestMerge(target, { ...(password ? { password } : {}), merge: { network: this.info, topology: this.config } });
  }

  /** A part of this network rejoins the rest: the key hash proves membership. */
  private async heal() {
    if (this.state !== "ready" || !this.info || !this.key) return;
    const keyHash = await sha256(this.key);
    return this.requestMerge(this.info.id, { merge: { network: this.info, topology: this.config, keyHash } });
  }

  private requestMerge(target: string, request: JoinRequest) {
    if (this.merging) return Promise.reject(new Error("already merging"));

    return new Promise<void>((resolve, reject) => {
      const cancel = this.after(JOIN_TIMEOUT, () => this.failMerge(new Error("merge timed out")));
      this.merging = { id: target, entry: null, admit: null, resolve, reject, cancel };
      this.ids.add(target);
      this.bootstrap.join(target, request).catch(error => this.failMerge(toError(error)));
    });
  }

  private failMerge(error: Error) {
    const merging = this.merging;
    if (!merging) return;

    this.merging = null;
    merging.cancel();
    if (merging.id !== this.info?.id) this.ids.delete(merging.id);
    if (merging.entry) this.releaseBridge(merging.entry);
    merging.reject(error);
  }

  /** The engine wants the bridge for MERGE_LIMIT; after that only if the topology does. */
  private bridge(peer: PeerId) {
    this.bridges.set(peer, { kept: this.wanted.has(peer) });
    this.want(peer);
    this.after(MERGE_LIMIT, () => this.releaseBridge(peer));
  }

  private releaseBridge(peer: PeerId) {
    const bridge = this.bridges.get(peer);
    if (!bridge) return;
    this.bridges.delete(peer);
    if (!bridge.kept) this.unwant(peer);
  }

  /** The requester's bridge is open: adopt the target's identity, then both ends merge. */
  private bridged(entry: PeerId) {
    const merging = this.merging;
    if (!merging?.admit || merging.entry !== entry) return;

    this.merging = null;
    merging.cancel();
    const { network, key } = merging.admit;
    if (network.id !== this.info?.id)
    {
      this.originate(this.system(NetworkType.Adopt, BROADCAST, { network, key }));
      this.adopt(network, key);
    }
    this.mergedWith(entry);
    merging.resolve();
  }

  private mergedWith(peer: PeerId) {
    this.guard("merge", () => this.node?.merge?.(peer));
    this.emit("merged", { bridge: peer, network: this.info });
  }

  /** Switches to another network's identity. The old id stays accepted for messages in flight. */
  private adopt(network: NetworkInfo, key: string) {
    const old = this.info?.id;
    this.ids.add(network.id);
    this.info = network;
    this.key = key;
    this.syncMedia();
    if (old && old !== network.id && this.anchored)
    {
      this.bootstrap.unanchor?.(old);
      this.anchors = null;
      this.setAnchored(false);
    }
  }

  /**
   * Changes the network's name, privacy, meta, password or media plan. Anchors only: the registry
   * takes the change, then every member gets it in a broadcast `network.adopt`.
   */
  async update(changes: NetworkUpdate): Promise<NetworkInfo> {
    if (this.state !== "ready" || !this.info || !this.key) throw new Error(`can't update, the network is ${this.state}`);
    if (!this.anchored || !this.bootstrap.update) throw new Error("only an anchor can update the network");

    const id = this.info.id;
    const updated = await this.bootstrap.update(id, changes);
    if (this.closed || this.info.id !== id) throw new Error("the network changed while updating");

    if (changes.password !== undefined) this.password = changes.password || undefined;
    this.applyUpdate(updated);
    this.originate(this.system(NetworkType.Adopt, BROADCAST, { network: this.info, key: this.key }));
    return this.info;
  }

  /** Takes what an update may change from `network`; the rest of the info (beacon, anchors) stays. */
  private applyUpdate(network: NetworkInfo) {
    const info: NetworkInfo = { ...this.info!, name: network.name, private: network.private };
    for (const field of ["meta", "media"] as const)
    {
      if (network[field] === undefined) delete info[field];
      else info[field] = network[field] as any;
    }
    this.info = info;
    this.syncMedia();
    this.emit("update", info);
  }

  /** Leaves gracefully: the topology says goodbye, then the network closes. */
  leave() {
    if (this.closed) return;
    this.guard("leave", () => this.node?.leave?.());
    this.close();
  }

  /** Sends `network.leave` on every link, then releases every link, timer and listener. */
  close() {
    if (this.closed) return;

    this.guard("close", () => this.node?.close?.());
    if (this.anchored && this.info) this.bootstrap.unanchor?.(this.info.id);
    this.anchored = false;
    const joining = this.joining;
    const merging = this.merging;
    this.joining = null;
    this.merging = null;
    this.entry = null;
    this.state = "closed";

    for (const peer of this.open) this.sendOn(peer, this.system(NetworkType.Leave, peer, { peer: this.me }));

    joining?.cancel();
    joining?.reject(new Error("closed"));
    merging?.reject(new Error("closed"));
    this.bridges.clear();
    this.settle.reject(new Error("closed"));
    for (const id of this.timers) this.clock.clearTimeout(id);
    this.timers.clear();
    for (const ping of this.pings.values()) ping.reject(new Error("closed"));
    this.pings.clear();
    this.admitted.clear();
    this.bootstrap.removeEventListener("message", this.handleBootstrapMessage);
    this.bootstrap.removeEventListener("anchors", this.handleAnchors);
    this.bootstrap.removeEventListener("lost", this.handleLost);
    this.rooms.clear();

    // detach now, close after the leaves are on their way
    const links = [...this.links.values()];
    for (const attached of links) this.detach(attached);
    this.links.clear();
    this.open.clear();
    this.wanted.clear();
    this.pending.clear();
    this.back.clear();
    this.connector.close();
    this.media.close();
    queueMicrotask(() => {
      for (const attached of links) attached.link.close();
    });
    this.emit("close", null);
  }

  // app messages
  /** Sends an app message to `peer`. @throws {RangeError} for a reserved type */
  send(peer: PeerId, type: string, data: unknown) {
    if (isReserved(type)) throw new RangeError(`"${type}" is a reserved type`);
    return this.originate(Message.Create({ type, sender: this.me, receiver: peer }, data as object));
  }

  broadcast(type: string, data: unknown) {
    return this.send(BROADCAST, type, data);
  }

  /** Sends an app message to whoever owns hash(key). Needs a topology with `owner`. */
  sendKey(key: string, type: string, data: unknown) {
    if (!this.node?.owner)
    {
      this.error("sendKey", "the topology has no owner(), so keys can't be routed", { key });
      return false;
    }
    return this.send(keyReceiver(key), type, data);
  }

  // links (rules 2-4)
  /** Hands the network a link from its connector. Opening is reported to the topology once the link opens. */
  attach(link: Link) {
    if (this.closed || link.id === this.me)
    {
      link.close();
      return;
    }

    const current = this.links.get(link.id);
    if (current?.link === link) return;
    if (current)
    {
      // a new connection to the same peer replaces the old one quietly
      this.detach(current);
      current.link.close();
      if (!link.open) this.open.delete(link.id);
    }

    const peer = link.id;
    const attached: Attached = {
      link,
      carrier: { peer, send: bytes => link.send(bytes) },
      reported: current?.reported ?? false,
      handleOpen: () => this.handleOpen(attached),
      handleMessage: (event: Event) => this.receive((event as CustomEvent<Uint8Array>).detail, attached.carrier),
      handleClose: () => this.handleClose(attached),
    };
    link.addEventListener("open", attached.handleOpen);
    link.addEventListener("message", attached.handleMessage);
    link.addEventListener("close", attached.handleClose);
    this.links.set(peer, attached);

    if (link.open) this.handleOpen(attached);
  }

  /** The connector's attempt to `peer` ended without a link. */
  fail(peer: PeerId) {
    if (!this.pending.delete(peer) || this.links.has(peer)) return;
    const wanted = this.wanted.delete(peer);
    this.debug("link", `no link to ${peer}`, { peer });
    if (wanted) this.lost(peer, false);
  }

  private want(peer: PeerId, via?: PeerId[]) {
    if (peer === this.me || this.closed) return;

    this.wanted.add(peer);
    if (this.links.has(peer) || this.pending.has(peer)) return;

    this.pending.add(peer);
    this.guard("connector", () => this.connector.connect(this, peer, via?.length ? via : undefined));
  }

  private unwant(peer: PeerId) {
    if (!this.wanted.delete(peer)) return;

    const attached = this.links.get(peer);
    if (attached?.link.open)
    {
      // rule 2: tell the peer; it closes the link unless it wants it
      this.sendOn(peer, this.system(NetworkType.Prune, peer, {}));
      return;
    }

    if (this.pending.delete(peer))
    {
      this.connector.cancel(peer);
      if (attached)
      {
        this.detach(attached);
        this.links.delete(peer);
        attached.link.close();
      }
    }
  }

  private detach(attached: Attached) {
    attached.link.removeEventListener("open", attached.handleOpen);
    attached.link.removeEventListener("message", attached.handleMessage);
    attached.link.removeEventListener("close", attached.handleClose);
  }

  private handleOpen(attached: Attached) {
    const peer = attached.link.id;
    if (this.closed || this.links.get(peer) !== attached) return;

    this.pending.delete(peer);
    this.open.add(peer);
    if (!attached.reported)
    {
      attached.reported = true;
      this.guard("link", () => this.node?.link?.(peer, true, false));
      this.media.refresh();
      this.emit("link", { peer, open: true, left: false });
    }

    if (this.joining?.entry === peer) this.started(peer);
    if (this.merging?.entry === peer) this.bridged(peer);

    const admitted = this.admitted.get(peer);
    if (admitted)
    {
      admitted.cancel();
      this.admitted.delete(peer);
      if (admitted.merge) this.mergedWith(peer);
      else this.guard("join", () => this.node?.join?.(peer, admitted.profile));
    }
  }

  private handleClose(attached: Attached) {
    const peer = attached.link.id;
    if (this.links.get(peer) !== attached) return;

    this.detach(attached);
    this.links.delete(peer);
    this.open.delete(peer);
    this.pending.delete(peer);
    const wanted = this.wanted.delete(peer);
    const left = this.leaving.delete(peer);
    if (this.entry === peer) this.entry = null;

    if (attached.reported || wanted) this.lost(peer, left);
    if (this.joining?.entry === peer) this.failJoin(new Error("the entry link closed"));
  }

  private lost(peer: PeerId, left: boolean) {
    this.guard("link", () => this.node?.link?.(peer, false, left));
    this.media.refresh();
    this.emit("link", { peer, open: false, left });
  }

  /** Applies `info.media` when it changed. */
  private syncMedia() {
    const plan = this.info?.media ?? {};
    if (JSON.stringify(plan) !== JSON.stringify(this.media.plan)) this.media.setPlan(plan);
  }

  // pipeline (rules 5, 6)
  /** Bytes from any carrier: a link, the bootstrap, a parent network. Never throws. */
  receive(bytes: Uint8Array, carrier: Carrier) {
    const message = read(bytes);
    if (!message)
    {
      this.debug("read", "malformed message", { from: carrier.peer });
      return;
    }
    this.take(message, carrier);
  }

  /** Sends a message for the connector (or the bootstrap) along the send path, through `via` first. */
  signal(peer: PeerId, message: Message, via?: PeerId[]) {
    message.meta.receiver = peer;
    const hops = this.waypoints(via);
    if (hops.length) message.meta.via = hops;
    return this.originate(message);
  }

  private take(message: Message, carrier: Carrier) {
    if (this.closed) return;

    try
    {
      const meta = message.meta;
      const type = meta.type;

      if (meta.network !== undefined && !this.ids.has(meta.network))
      {
        this.debug("network", `not for this network (${meta.network})`, meta);
        return;
      }
      // a direct topology only takes app messages straight from their sender
      if (this.node?.direct && carrier.peer && meta.sender !== carrier.peer && !isReserved(type))
      {
        this.debug("forged", `app message from ${meta.sender} arrived over ${carrier.peer}`, meta);
        return;
      }

      if (meta.sender && meta.sender !== carrier.peer && meta.sender !== this.me) this.remember(meta.sender, carrier);
      if (meta.receiver === BROADCAST && !this.seen.check(meta.id)) return;

      if (meta.via?.[0] === this.me)
      {
        meta.via.shift();
        if (meta.via.length === 0) delete meta.via;
      }

      const action = this.decide(meta);
      if (action === "drop")
      {
        this.debug("drop", `dropped ${type} from ${meta.sender}`, meta);
        return;
      }

      if (action === "deliver" || action === "both") this.deliver(message, carrier);
      if (action === "forward" || action === "both") this.route(message);
    }
    catch (error)
    {
      this.error("receive", "failed to handle a message", { from: carrier.peer, error });
    }
  }

  private decide(meta: Meta): RelayAction {
    // messages still on their way to a waypoint are never delivered here
    if (meta.via?.length)
    {
      if (meta.hops.includes(this.me)) return "drop";
      meta.hops.push(this.me);
      meta.ttl = Math.max(0, meta.ttl - 1);
      return meta.ttl > 0 ? "forward" : "drop";
    }

    const override = this.node?.filter ? this.guard("filter", () => this.node!.filter!(meta)) : undefined;
    if (override === "drop") return "drop";
    if (override === "deliver")
    {
      if (meta.hops.includes(this.me)) return "drop";
      meta.hops.push(this.me);
      return "deliver";
    }

    const action = relay(meta, this.me);
    if (action === "drop" || !override) return action;
    return override;
  }

  private deliver(message: Message, carrier: Carrier) {
    const meta = message.meta;
    const type = meta.type;

    if (type.startsWith(TOPOLOGY_PREFIX))
    {
      if (!this.node) return void this.debug("topology", "no topology yet", meta);
      this.received.set(meta, message);
      const payload = message.parse();
      this.guard("message", () => this.node!.message(meta.sender, type.slice(TOPOLOGY_PREFIX.length), payload, meta));
      return;
    }
    if (type.startsWith("handshake.")) return void this.guard("connector", () => this.connector.handle(this, message));
    if (type.startsWith("network.")) return void this.handleNetwork(message, carrier);
    if (isReserved(type)) return void this.debug("ignored", `${type} isn't for the network`, meta);

    this.emit("message", message);
  }

  /** Rule 5: the send path for a message this node sends or forwards. */
  private route(message: Message): boolean {
    const meta = message.meta;

    if (meta.receiver === BROADCAST) return this.sendHops(this.hops(meta), message) > 0;

    const target = meta.via?.[0] ?? meta.receiver;
    let bytes: Uint8Array | null = null;
    const encoded = () => bytes ??= message.toBinary(true);

    if (this.sendLink(target, encoded)) return true;

    // a back path that leads to a node this message already passed would only loop
    const back = this.back.get(target);
    const fresh = !!back && this.clock.now() - back.at < BACK_TTL && !(back.carrier.peer && meta.hops.includes(back.carrier.peer));
    if (fresh && back!.carrier.send(encoded())) return true;

    const hops = this.hops(target === meta.receiver ? meta : { ...meta, receiver: target });
    if (hops.length && this.sendHops(hops, message) > 0) return true;

    if (this.entry && this.entry !== target && this.sendLink(this.entry, encoded)) return true;

    // the bootstrap only carries a node's own messages
    if (meta.sender === this.me && !isKeyReceiver(target) && this.bootstrap.signal(target, encoded())) return true;

    this.debug("route", `no route to ${target}`, meta);
    return false;
  }

  /** A message this node starts. */
  private originate(message: Message) {
    if (this.closed) return false;

    const meta = message.meta;
    meta.network ??= this.info?.id ?? this.joining?.id;
    const ttl = this.node?.ttl ? this.guard("ttl", () => this.node!.ttl!()) : undefined;
    if (ttl !== undefined) meta.ttl = Math.max(meta.ttl, ttl);

    // a key this node owns itself is delivered here
    const mine = isKeyReceiver(meta.receiver) && this.node?.filter && this.guard("filter", () => this.node!.filter!(meta)) === "deliver";
    if (meta.receiver === this.me || mine)
    {
      queueMicrotask(() => this.closed || this.deliver(message, LOCAL));
      return true;
    }
    if (meta.receiver === BROADCAST) this.seen.check(meta.id);
    return this.route(message);
  }

  private hops(meta: Meta): Hop[] {
    if (!this.node) return [];
    return this.guard("route", () => this.node!.route(meta)) ?? [];
  }

  private sendHops(hops: Hop[], message: Message) {
    const meta = message.meta;
    const hint = meta.hint;
    const encoded = new Map<string | undefined, Uint8Array>();
    let sent = 0;

    for (const hop of hops)
    {
      const [peer, next] = Array.isArray(hop) ? hop : [hop, hint];
      if (!this.open.has(peer)) continue;

      let bytes = encoded.get(next);
      if (!bytes)
      {
        if (next === undefined) delete meta.hint;
        else meta.hint = next;
        bytes = message.toBinary(true);
        encoded.set(next, bytes);
      }
      if (this.links.get(peer)?.link.send(bytes)) sent++;
    }

    if (hint === undefined) delete meta.hint;
    else meta.hint = hint;
    return sent;
  }

  private sendLink(peer: PeerId, bytes: () => Uint8Array) {
    const attached = this.links.get(peer);
    return !!attached?.link.open && attached.link.send(bytes());
  }

  /** Link-level messages go on the link only, never relayed. */
  private sendOn(peer: PeerId, message: Message) {
    this.links.get(peer)?.link.send(message.toBinary(true));
  }

  private remember(sender: PeerId, carrier: Carrier) {
    this.back.delete(sender);
    this.back.set(sender, { carrier, at: this.clock.now() });
    if (this.back.size > BACK_LIMIT) this.back.delete(this.back.keys().next().value!);
  }

  private system<T extends keyof PayloadMap>(type: T, receiver: PeerId, payload: PayloadMap[T]) {
    return Message.Create({ type, sender: this.me, receiver, network: this.info?.id ?? this.joining?.id }, payload);
  }

  // engine messages
  private handleNetwork(message: Message, carrier: Carrier) {
    const meta = message.meta;
    const sender = meta.sender;
    const fromLink = carrier.peer === sender;

    switch (meta.type)
    {
      case NetworkType.Prune:
        if (!fromLink) return;
        if (!this.wanted.has(sender)) this.links.get(sender)?.link.close();
        return;

      case NetworkType.Leave:
        if (fromLink) this.leaving.add(sender);
        return;

      case NetworkType.Ping:
        if (fromLink) this.sendOn(sender, this.system(NetworkType.Pong, sender, { n: (message.parse() as PayloadMap[NetworkType.Ping]).n }));
        return;

      case NetworkType.Pong: {
        if (!fromLink) return;
        const { n } = message.parse() as PayloadMap[NetworkType.Pong];
        const ping = this.pings.get(n);
        if (!ping) return;
        this.pings.delete(n);
        ping.cancel();
        ping.resolve(this.clock.now() - ping.at);
        return;
      }

      case NetworkType.Room: {
        const { room, message: text } = message.parse() as PayloadMap[NetworkType.Room];
        const take = this.rooms.get(room);
        if (!take) return void this.debug("room", `no network carried as ${room}`, meta);
        const bytes = fromBase64(text);
        const carried = bytes && read(bytes);
        if (!carried) return void this.debug("room", "malformed carried message", meta);
        this.guard("room", () => take(carried, sender));
        return;
      }

      case NetworkType.Beacon:
        this.lastBeacon = this.clock.now();
        return;

      case NetworkType.Anchor:
        if (this.state === "ready" && !this.anchored) this.emit("anchor-request", { from: sender });
        return;

      case NetworkType.Join:
        this.handleJoin(sender, message.parse() as PayloadMap[NetworkType.Join]).catch(error => this.error("join", "failed to handle a join", { sender, error }));
        return;

      case NetworkType.Admit:
        return this.handleAdmit(sender, message.parse() as PayloadMap[NetworkType.Admit]);

      case NetworkType.Adopt: {
        const { network, key } = message.parse() as PayloadMap[NetworkType.Adopt];
        if (this.state !== "ready" || !this.info) return;
        if (network.id !== this.info.id) this.adopt(network, key);
        // the same network: an anchor updated it, the key proves it's one of us
        else if (key === this.key) this.applyUpdate(network);
        return;
      }

      case NetworkType.Reject: {
        const error = new Error((message.parse() as PayloadMap[NetworkType.Reject]).reason);
        if (this.joining) this.failJoin(error);
        else if (this.merging) this.failMerge(error);
        return;
      }

      default:
        this.debug("ignored", `${meta.type} isn't handled by this engine`, meta);
    }
  }

  // join pipeline
  private async handleJoin(peer: PeerId, request: PayloadMap[NetworkType.Join]) {
    if (this.state !== "ready" || !this.info || !this.key) return void this.debug("join", `not ready for ${peer}`, { peer });

    const reject = (reason: string) => this.originate(this.system(NetworkType.Reject, peer, { reason }));

    if (request.merge) return this.handleMergeJoin(peer, request, reject);
    if (!this.bootstrap.checksPassword && this.password && request.password !== this.password) return void reject("wrong password");

    let accepted = true;
    try
    {
      accepted = await (this.options.accept?.(peer, request.profile) ?? true);
    }
    catch (error)
    {
      this.error("accept", "the accept hook threw", { peer, error });
      accepted = false;
    }
    if (this.closed) return;
    if (!accepted) return void reject("rejected");

    this.admitted.get(peer)?.cancel();
    const cancel = this.after(ADMIT_TIMEOUT, () => this.admitted.delete(peer));
    this.admitted.set(peer, { profile: request.profile, cancel });
    this.originate(this.system(NetworkType.Admit, peer, { network: this.info, key: this.key, merge: false }));

    // already linked (a rejoin): the topology hears about it right away
    if (this.open.has(peer))
    {
      cancel();
      this.admitted.delete(peer);
      this.guard("join", () => this.node?.join?.(peer, request.profile));
    }
  }

  /** Rule 10 on the entry: same topology config, a topology that merges, then a healed split or the app's yes. */
  private async handleMergeJoin(peer: PeerId, request: JoinRequest, reject: (reason: string) => void) {
    const merge = request.merge!;
    const theirs = typeof merge.topology === "string" ? { name: merge.topology } : merge.topology;
    if (canonical(theirs) !== canonical(this.config)) return void reject("topology mismatch");
    if (!this.node?.merge) return void reject("topology can't merge");

    const healing = merge.network.id === this.info!.id && !!merge.keyHash && merge.keyHash === await sha256(this.key!);
    if (!healing)
    {
      if (!this.bootstrap.checksPassword && this.password && request.password !== this.password) return void reject("wrong password");
      let accepted = false;
      try
      {
        accepted = await (this.options.acceptMerge?.(merge.network) ?? false);
      }
      catch (error)
      {
        this.error("accept", "the acceptMerge hook threw", { peer, error });
      }
      if (this.closed) return;
      if (!accepted) return void reject("merge refused");
    }

    this.ids.add(merge.network.id);
    this.admitted.get(peer)?.cancel();
    const cancel = this.after(ADMIT_TIMEOUT, () => this.admitted.delete(peer));
    this.admitted.set(peer, { merge: true, cancel });
    this.originate(this.system(NetworkType.Admit, peer, { network: this.info!, key: this.key!, merge: true }));

    if (this.open.has(peer))
    {
      cancel();
      this.admitted.delete(peer);
      this.mergedWith(peer);
    }
  }

  private handleMergeAdmit(entry: PeerId, payload: PayloadMap[NetworkType.Admit]) {
    const merging = this.merging;
    if (!merging || merging.entry || payload.network.id !== merging.id) return void this.debug("admit", `unexpected merge admit from ${entry}`, { entry });

    merging.entry = entry;
    merging.admit = { network: payload.network, key: payload.key };
    this.bridge(entry);
    if (this.open.has(entry)) this.bridged(entry);
  }

  private handleAdmit(entry: PeerId, payload: PayloadMap[NetworkType.Admit]) {
    if (payload.merge) return this.handleMergeAdmit(entry, payload);
    const joining = this.joining;
    if (!joining || joining.entry) return void this.debug("admit", `unexpected admit from ${entry}`, { entry });

    this.info = payload.network;
    this.key = payload.key;
    this.ids.add(payload.network.id);
    this.syncMedia();
    if (!this.createNode(payload.network.topology)) return void this.failJoin(new Error("no topology"));

    joining.entry = entry;
    this.entry = entry;
    this.entryKept = false;
    this.want(entry);
    if (this.open.has(entry)) this.started(entry);
  }

  /** The entry link is open: start the topology through it. The join timeout keeps running. */
  private async started(entry: PeerId) {
    const joining = this.joining;
    if (!joining || joining.entry !== entry || joining.starting) return;
    joining.starting = true;

    try
    {
      await this.start(entry);
    }
    catch (error)
    {
      return this.failJoin(error instanceof Error ? error : new Error(String(error)));
    }
    if (this.joining !== joining) return;

    joining.cancel();
    this.joining = null;
    this.state = "ready";
    this.watchBeacons();
    // after ready the entry link is an ordinary want: kept only when the topology connected it
    if (!this.entryKept && this.entry === entry) this.unwant(entry);
    this.entry = null;
    this.settle.resolve();
    joining.resolve();

    // every joiner offers itself; the registry turns it down once the target is met
    if (this.bootstrap.anchor) this.anchor().catch(error => this.debug("anchor", "anchoring failed", { error }));
  }

  private failJoin(error: Error) {
    const joining = this.joining;
    if (!joining) return;

    this.joining = null;
    joining.cancel();
    if (this.state === "joining") this.state = "idle";
    if (this.entry)
    {
      this.unwant(this.entry);
      this.entry = null;
    }
    this.settle.reject(error);
    joining.reject(error);
  }

  private async start(entry: PeerId | null) {
    try
    {
      await this.node!.start(entry);
    }
    catch (error)
    {
      this.error("topology", "start failed", { error });
      throw error;
    }
  }

  private createNode(shared: string | TopologyConfig) {
    if (this.node) return true;

    const source = this.options.topology ?? shared;
    let factory: Topology | undefined;
    if (typeof source === "function")
    {
      this.config = typeof shared === "string" ? { name: shared } : shared;
      factory = source;
    }
    else
    {
      this.config = typeof source === "string" ? { name: source } : source;
      factory = this.guard("resolve", () => resolveTopology(source, error => this.error("topology", error.message, { topology: source })));
    }
    if (!factory) return false;

    this.node = this.guard("topology", () => factory(this.context)) ?? null;
    return !!this.node;
  }

  // the context topologies see
  private createContext(): TopologyContext {
    const self = this;
    return {
      get me() { return self.me; },
      get config() { return self.config; },
      links: this.open,
      connect: (peer, options) => {
        if (peer === this.entry) this.entryKept = true;
        const bridge = this.bridges.get(peer);
        if (bridge) bridge.kept = true;
        this.want(peer, options?.via);
      },
      disconnect: peer => {
        if (peer === this.entry) this.entryKept = false;
        const bridge = this.bridges.get(peer);
        if (bridge) bridge.kept = false;
        this.unwant(peer);
      },
      wants: peer => this.wanted.has(peer),
      send: (peer, type, payload, options) => {
        const message = Message.Create({ type: TOPOLOGY_PREFIX + type, sender: this.me, receiver: peer }, payload as object);
        this.applyOptions(message.meta, options);
        this.originate(message);
      },
      forward: (peer, meta, options) => this.forward(peer, meta, options),
      rtt: peer => this.rtt(peer),
      every: (ms, fn) => this.every(ms, () => this.guard("every", fn)),
      after: (ms, fn) => this.after(ms, () => this.guard("after", fn)),
      emit: (type, detail) => this.emit(type, detail),
      random: () => this.random(),
      now: () => this.clock.now(),
    };
  }

  private applyOptions(meta: Meta, options?: SendOptions) {
    if (options?.hint !== undefined) meta.hint = options.hint;
    const via = this.waypoints(options?.via);
    if (via.length) meta.via = via;
  }

  /** Waypoints without the leading ones that are me: I'm already there. */
  private waypoints(via?: PeerId[]) {
    const hops = [...(via ?? [])];
    while (hops[0] === this.me) hops.shift();
    return hops;
  }

  private forward(peer: PeerId, meta: Meta, options?: SendOptions) {
    const message = this.received.get(meta);
    if (!message) return void this.error("forward", "forward takes the meta of a received topology message", { peer });
    if (meta.ttl <= 1) return void this.debug("forward", "ttl spent", meta);

    const { via, hint, ...rest } = meta;
    const next = new Message({ ...rest, receiver: peer, ttl: meta.ttl - 1, hops: [...meta.hops] }, message.parse());
    this.applyOptions(next.meta, options);
    this.route(next);
  }

  private rtt(peer: PeerId) {
    return new Promise<number>((resolve, reject) => {
      if (!this.open.has(peer)) return void reject(new Error(`not linked to ${peer}`));

      const n = this.ping++;
      const cancel = this.after(RTT_TIMEOUT, () => {
        this.pings.delete(n);
        reject(new Error(`no pong from ${peer}`));
      });
      this.pings.set(n, { resolve, reject, at: this.clock.now(), cancel });
      this.sendOn(peer, this.system(NetworkType.Ping, peer, { n }));
    });
  }

  // timers (rule 8)
  private after(ms: number, fn: () => void) {
    if (this.closed) return () => { };

    const id = this.clock.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);

    return () => {
      if (!this.timers.delete(id)) return;
      this.clock.clearTimeout(id);
    };
  }

  private every(ms: number, fn: () => void) {
    let cancel = () => { };
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      cancel = this.after(ms, tick);
      fn();
    };
    cancel = this.after(ms, tick);

    return () => {
      stopped = true;
      cancel();
    };
  }

  /** Rule 9: topology and hook calls never throw into the engine. */
  private guard<T>(where: string, fn: () => T): T | undefined {
    try
    {
      const result = fn();
      if (result instanceof Promise) result.catch(error => this.error("topology", `${where} failed`, { error }));
      return result;
    }
    catch (error)
    {
      this.error("topology", `${where} threw`, { error });
      return undefined;
    }
  }

  // event handlers
  private handleAnchors = (event: Event) => {
    const detail = (event as CustomEvent<{ network: string; anchors: PeerId[]; target: number }>).detail;
    if (this.closed || !this.ids.has(detail.network)) return;

    this.anchors = { anchors: [...detail.anchors], target: detail.target };
    this.setAnchored(detail.anchors.includes(this.me));
    this.recruit();
  }

  private handleMediaEvent = (event: Event) => {
    this.emit(event.type, (event as CustomEvent).detail);
  }

  /** The bootstrap can't carry this network any more. */
  private handleLost = () => {
    this.close();
  }

  private handleBootstrapMessage = (event: Event) => {
    const { message, carrier } = (event as CustomEvent<BootstrapMessage>).detail;
    this.take(message, carrier);
  }
}
