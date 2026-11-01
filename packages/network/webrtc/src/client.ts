import {
  BROADCAST,
  MediaPlan,
  HandshakeType,
  isReserved,
  Message,
  Meta,
  NetworkInfo,
  isProfile,
  NetworkType,
  PayloadMap,
  PeerId,
  Profile,
  SERVER,
  SignalType,
  TopologyConfig,
} from "@papit/peer-message";

import { Emitter } from "./emitter";
import { Media } from "./components/media";
import { Network } from "./components/network";
import { HANDSHAKE_TIMEOUT, type Offer } from "./components/handshake";
import { PeerLink } from "./components/peer";
import { SocketLink } from "./components/socket";
import { resolveTopology } from "./components/topology";

/** How long `create`, `list` and `join` wait for the server or the entry peer. */
export const REQUEST_TIMEOUT = 15_000;
/** How long the first connection may fail before the status turns `"waking"`. */
export const WAKING_AFTER = 3_000;
/** ms between `/health` pings while not connected. */
export const WAKE_INTERVAL = 4_000;

/** How many times a link that failed to open is tried again. */
export const LINK_RETRIES = 3;
/** ms before the first retry of a link; each further retry waits this much longer. */
export const LINK_RETRY_DELAY = 2_000;

/** How long a merge may take until both groups share the member list. */
export const MERGE_TIMEOUT = 30_000;
/** ms per member in the window peers pick their start from after a merge, so they don't all signal at once. */
export const MERGE_PACE = 5;
/** Links a peer opens at once after a merge. */
export const MERGE_LINKS = 4;
/** ms a peer waits with every link up before it closes the ones the topology no longer wants. */
export const LINK_SETTLE = 3_000;
/** ms after a merge a peer stops waiting for the links it still wants. */
export const MERGE_LIMIT = 60_000;

/** Connection state of a `Client`, see `client.status`. */
export type ClientStatus = "connecting" | "waking" | "connected" | "reconnecting" | "closed";

/** Turns a `ws:`/`wss:` url into the matching `http:`/`https:` origin. */
export function httpUrl(url: string | URL) {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === "wss:" ? "https:" : parsed.protocol === "ws:" ? "http:" : parsed.protocol;
  return parsed.origin;
}

export type ClientOptions = {
  /** The signal server, e.g. `ws://localhost:3000`. */
  url: string | URL;
  protocols?: string | string[];
  /** Passed to every `RTCPeerConnection`, e.g. `{ iceServers }`. */
  rtc?: RTCConfiguration;
  /**
   * Topology for networks you `create`: a registered name or a config, e.g. `{ name: "multicast", fanout: 5 }`.
   * Joined networks use the one they were created with. Default `"mesh"`.
   */
  topology?: string | TopologyConfig;
  /**
   * Keep the signalling socket once joined and linked. `"host"` keeps it on the host only: the others
   * drop theirs once linked, and their signalling (handshakes of newcomers) goes through the host.
   * False drops it everywhere. Default `"host"`.
   */
  keepSocket?: boolean | "host";
  /** Called on the entry peer for each newcomer; false rejects them. Default: accept everyone. */
  accept?(newcomer: PeerId, info: NetworkInfo): boolean;
  /** Called on the host when another network asks to merge, with its real size. Default: refuse, since a merge can move this whole network. */
  acceptMerge?(network: NetworkInfo, size: number): boolean;
  /** ms before `create`, `list` and `join` reject. */
  timeout?: number;
  /** ms a link may take to open, doubled when ICE connected in time. Default `HANDSHAKE_TIMEOUT`. */
  linkTimeout?: number;
  /** ms without a server connection before giving up for good (`ready` rejects). Default: keep trying. */
  connectTimeout?: number;
  /** While not connected, ping `<http url>/health` every few seconds so a sleeping host boots. Default true. */
  wake?: boolean;
  /** What this peer says about itself, e.g. `{ name }`. At most 1 KB as JSON. */
  profile?: Profile;
  /** Becoming host without a socket opens a new one and registers the network again, so others can still join. Default true. */
  recreate?: boolean;
}

/** What `client.room` opens. A room is always private: its id and host travel by invite. */
export type RoomOptions = {
  name: string;
  /** Checked by the room's host. It travels over lobby peers, which can read it. */
  password?: string;
  meta?: Record<string, unknown>;
  media?: MediaPlan;
  /** Default `"mesh"`, whatever the parent network uses. */
  topology?: string | TopologyConfig;
  /** Called on the room's host for each newcomer; false rejects them. Default: accept everyone. */
  accept?(newcomer: PeerId, info: NetworkInfo): boolean;
  /** Default: the parent client's profile. */
  profile?: Profile;
}

/** Detail of the client's `"message"` event. */
export type ClientMessage<Payload = unknown> = {
  type: string;
  sender: PeerId;
  payload: Payload;
  meta: Meta;
}

type Retry = {
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
}

type Merge = {
  // the other host, empty while waiting for its answer
  peer: PeerId;
  size: number;
  stays: boolean;
  done: Promise<NetworkInfo>;
  resolve(network: NetworkInfo): void;
  reject(reason: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

// a peer's way through the links a merge asks for
type Pace = {
  start: ReturnType<typeof setTimeout> | null;
  settle: ReturnType<typeof setTimeout> | null;
  limit: ReturnType<typeof setTimeout>;
}

type Request = {
  id: string;
  match(message: Message): unknown;
  resolve(value: any): void;
  reject(reason: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Browser peer-to-peer client: talks to `@papit/signal-server`, creates or joins a network and keeps
 * the links its topology wants, over WebRTC data channels. App messages travel peer to peer and
 * fall back to the server while no peer route exists.
 *
 * @fires message - `CustomEvent<ClientMessage>`, an app message for this peer (or a broadcast)
 * @fires peer - `CustomEvent<PeerId>`, a direct link opened
 * @fires peer-left - `CustomEvent<PeerId>`, a direct link closed
 * @fires members - `CustomEvent<{ members: PeerId[], profiles: Record<PeerId, Profile> }>`, the members or their profiles changed
 * @fires status - `CustomEvent<ClientStatus>`, see `status`
 * @fires host - `CustomEvent<PeerId>`, the host changed
 * @fires server-id - `CustomEvent<string>`, the id the server knows the network by changed, see `serverId`
 * @fires merged - `CustomEvent<NetworkInfo>`, this peer's network merged with another and this is the result
 * @fires unreachable - `CustomEvent<{ receiver, ref }>`, a message could not be delivered
 * @fires drop - `CustomEvent<Message>`, a received message was dropped (loop, ttl, filter)
 * @fires error - `CustomEvent<EmitterEvent>`
 * @fires debug - `CustomEvent<EmitterEvent>`
 *
 * Media (streams, channels) lives on `client.media`, see `Media`.
 *
 * `client.room` opens a network over the peers this client already has, with no socket and nothing on
 * the server. The room is a `Client` of its own, with its own `RTCPeerConnection`s. It survives
 * `leave()` on its parent and closes with `close()`.
 */
export class Client extends Emitter {
  /** This peer's id, null until the server welcomes it. */
  public id: PeerId | null = null;
  /** The network joined or created, null outside one. */
  public network: NetworkInfo | null = null;
  /** Resolves with this peer's id once the server welcomes it. */
  public readonly ready: Promise<PeerId>;
  /** The signalling socket, null for a room. */
  public socket: SocketLink | null;
  // an id the server assigned on a reconnect while in a network, taken on leave
  private reassigned: PeerId | null = null;
  // the socket was closed on purpose (keepSocket), the client is still in its network
  private dropped = false;
  // waiting for the server's go-ahead to close the socket
  private draining = false;
  // the network's id on the server after the host registered it again
  private serverNetwork: string | null = null;
  // the network's password, kept so a new host can register it again
  private password: string | undefined;
  /** The router, created on the first welcome. */
  public router: Network | null = null;
  /** Media plan, captures, remote streams and plan channels. */
  public readonly media: Media;

  private parent: Client | null = null;
  private roomId = "";
  private rooms = new Map<string, Client>();
  private pending = new Map<PeerId, PeerLink>();
  private retries = new Map<PeerId, Retry>();
  // members whose link dropped without a leave, kept until the link is back or the time is up
  private lost = new Map<PeerId, ReturnType<typeof setTimeout>>();
  private _status: ClientStatus = "connecting";
  private connectedOnce = false;
  private ownProfile: Profile;
  private profileMap = new Map<PeerId, Profile>();
  private wakingTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeTimer: ReturnType<typeof setInterval> | null = null;
  private requests: Request[] = [];
  private registerTimer: ReturnType<typeof setTimeout> | null = null;
  private joining: string | null = null;
  private merging: Merge | null = null;
  private pace: Pace | null = null;
  // peers whose link is closing on purpose, not because they left
  private pruned = new Set<PeerId>();
  private tidyTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly options: ClientOptions;

  constructor(options: ClientOptions, parent?: { client: Client; room: string }) {
    super();
    this.options = options;
    this.media = new Media({
      view: () => this.router?.view ?? null,
      topology: () => this.router?.topology ?? null,
    });
    this.media.addEventListener("error", this.handleForward);
    this.media.addEventListener("debug", this.handleForward);

    this.ownProfile = options.profile ?? {};

    if (parent)
    {
      this.parent = parent.client;
      this.roomId = parent.room;
      this.socket = null;
      this.dropped = true;
      this.id = parent.client.id;
      this._status = "connected";
      this.ready = Promise.resolve(this.id!);
      this.router = new Network({ me: this.id!, topology: options.topology });
      this.router.carrier = (receiver, message) => parent.client.carry(parent.room, receiver, message);
      this.attachRouter(this.router);
      return;
    }

    this.socket = this.openSocket();

    this.wakingTimer = setTimeout(() => {
      this.wakingTimer = null;
      if (this._status === "connecting") this.setStatus("waking");
    }, WAKING_AFTER);
    this.startWake();

    this.ready = new Promise<PeerId>((resolve, reject) => {
      this.socket!.addEventListener("welcome", (event: Event) => resolve((event as CustomEvent<PeerId>).detail), { once: true });
      this.socket!.addEventListener("close", () => reject(new Error(this.closed ? "client closed" : "could not connect to the server")), { once: true });
    });
    this.ready.catch(() => { });
  }

  /**
   * `connecting` → (`waking` when the first connect keeps failing for a few seconds) → `connected`;
   * `reconnecting` after a drop; `closed` once it gives up or `close()` is called.
   */
  get status(): ClientStatus {
    return this._status;
  }

  /** The id the server knows the network by, null outside one. Differs from `network.id` once a new host registered it again: invites use this one. */
  get serverId(): string | null {
    return this.serverNetwork ?? this.network?.id ?? null;
  }

  /** Every known member profile by id (yours included while in a network). */
  get profiles(): Record<PeerId, Profile> {
    return Object.fromEntries(this.profileMap);
  }

  /** A member's profile, or yours without an id. */
  profile(peer?: PeerId): Profile | undefined {
    if (peer === undefined || peer === this.id) return this.ownProfile;
    return this.profileMap.get(peer);
  }

  /**
   * Changes your profile. In a network the host learns it (`network.profile`) and shares it with
   * everyone in `network.members`. False, and an `"error"`, for a profile that isn't a JSON object up to 1 KB.
   */
  setProfile(profile: Profile) {
    if (!isProfile(profile))
    {
      this.error("profile", "a profile must be a JSON object of at most 1 KB", { profile });
      return false;
    }

    this.ownProfile = profile;
    if (!this.network || !this.id) return true;

    this.profileMap.set(this.id, profile);
    if (this.host === this.id)
    {
      this.broadcastMembers();
      this.emitMembers();
    }
    else if (this.host)
    {
      this.sendReserved(this.host, NetworkType.Profile, { profile });
    }
    return true;
  }

  /** Current members, sorted, this peer included. */
  get members(): readonly PeerId[] {
    return this.router?.view.members ?? [];
  }

  // the members in the host's order, which is what goes over the wire: `members` is sorted
  private order() {
    return [...this.router!.view.order!];
  }

  /** Peers with an open direct link. */
  get links(): readonly PeerId[] {
    return this.router?.view.links ?? [];
  }

  private openSocket() {
    const socket = new SocketLink(this.options.url, { protocols: this.options.protocols, timeout: this.options.connectTimeout });
    socket.addEventListener("welcome", this.handleWelcome);
    socket.addEventListener("close", this.handleSocketClose);
    socket.addEventListener("error", this.handleForward);
    socket.addEventListener("debug", this.handleForward);
    socket.addEventListener("disconnect", this.handleDisconnect);
    socket.addEventListener("open", this.handleSocketOpen);
    return socket;
  }

  get host(): PeerId | null {
    return this.network ? this.router?.view.host ?? null : null;
  }

  /** Registers a new network on the server; this peer becomes its host. */
  async create(options: { name: string; private?: boolean; password?: string; meta?: Record<string, unknown>; media?: MediaPlan }): Promise<NetworkInfo> {
    await this.ready;
    this.assertOnServer();
    if (this.network) throw new Error("already in a network, leave first");

    const network: NetworkInfo = await this.request(
      SignalType.Register,
      { ...options, topology: this.options.topology ?? "mesh" },
      message => message.meta.type === SignalType.Registered ? (message.payload as PayloadMap[SignalType.Registered]).network : undefined,
    );

    this.password = options.password;
    this.profileMap = new Map([[this.id!, this.ownProfile]]);
    this.enter(network, [this.id!], network.host);
    return network;
  }

  /**
   * Changes the network (host only) with `signal.update`. A new `media` plan is also sent to every
   * member as `network.media` and applied to every link.
   */
  async update(options: { name?: string; private?: boolean; password?: string; meta?: Record<string, unknown>; media?: MediaPlan }): Promise<NetworkInfo> {
    await this.ready;
    const network = this.network;
    if (!network) throw new Error("not in a network");
    if (this.host !== this.id) throw new Error("only the host can update the network");

    const { password: _, ...changes } = options;
    const updated: NetworkInfo = this.parent ? { ...network, ...changes } : await this.request(
      SignalType.Update,
      { ...options, network: this.serverNetwork ?? network.id },
      message => message.meta.type === SignalType.Updated ? (message.payload as PayloadMap[SignalType.Updated]).network : undefined,
    );
    if (!this.network || (this.serverNetwork ?? this.network.id) !== updated.id) return updated;
    if (options.password !== undefined) this.password = options.password || undefined;

    // the network keeps its own id when the server knows it under another
    this.network = { ...updated, id: this.network.id, size: this.network.size, host: this.router!.view.host };
    this.router!.info = this.network;
    if (options.media !== undefined)
    {
      this.media.setPlan(updated.media);
      for (const member of this.members)
      {
        if (member !== this.id) this.sendReserved(member, NetworkType.Media, { media: updated.media ?? {} });
      }
    }
    return this.network;
  }

  /** Public networks on the server. */
  async list(): Promise<NetworkInfo[]> {
    await this.ready;
    this.assertOnServer();
    return this.request(
      SignalType.List,
      {},
      message => message.meta.type === SignalType.Networks ? (message.payload as PayloadMap[SignalType.Networks]).networks : undefined,
    );
  }

  /**
   * Joins a network: the server passes the request to an entry peer, which welcomes (or rejects) us
   * and tells us whom to link to. Resolves on `network.welcome`; rejects on a server error, a reject,
   * an unreachable entry or a timeout.
   */
  async join(network: string, password?: string): Promise<NetworkInfo> {
    await this.ready;
    this.assertOnServer();
    if (this.network) throw new Error("already in a network, leave first");
    return this.enterVia(network, password);
  }

  // `host`: asks a room's host over the parent network instead of the server
  private async enterVia(network: string, password?: string, host?: PeerId): Promise<NetworkInfo> {
    this.joining = network;
    try
    {
      const payload = { ...(password ? { password } : {}), profile: this.ownProfile };
      const welcome: PayloadMap[NetworkType.Welcome] = await this.request(
        SignalType.Join,
        { network, ...payload },
        message => {
          if (message.meta.network !== network) return undefined;
          if (message.meta.type === NetworkType.Reject)
          {
            throw new Error(`rejected: ${(message.payload as PayloadMap[NetworkType.Reject]).reason}`);
          }
          return message.meta.type === NetworkType.Welcome ? message.payload : undefined;
        },
        host ? () => {
          const message = Message.Create({ type: NetworkType.Join, sender: this.id!, receiver: host, network }, payload);
          this.router!.send(message, { preferServer: true });
          return message;
        } : undefined,
      );

      this.password = password;
      if (network !== welcome.network.id) this.serverNetwork = network;
      this.profileMap = new Map(Object.entries(welcome.profiles ?? {}));
      this.profileMap.set(this.id!, this.ownProfile);
      this.enter(welcome.network, welcome.members, welcome.network.host);
      for (const peer of welcome.connect)
      {
        if (peer !== this.id && this.initiates(peer)) this.link(peer);
      }
      return welcome.network;
    }
    finally
    {
      this.joining = null;
    }
  }

  /**
   * Merges this network with another (host only, both hosts need a socket). The other host must allow
   * it with `acceptMerge`, and both networks must use the same topology. The larger network stays, a
   * tie keeps the lower host id: everyone ends up in it, keeping the links its topology still wants.
   * Only the hosts use the server, the rest happens over peer links. Resolves with the merged network.
   */
  async merge(network: string, password?: string): Promise<NetworkInfo> {
    await this.ready;
    this.assertOnServer();
    if (!this.network) throw new Error("not in a network");
    if (this.host !== this.id) throw new Error("only the host can merge the network");
    if (this.merging) throw new Error("already merging");
    if (this.dropped) await this.reopen();

    const merge = this.startMerge();
    const { size } = merge;
    try
    {
      const accept: PayloadMap[NetworkType.MergeAccept] = await this.request(
        SignalType.Merge,
        { network, from: this.serverId!, size, ...(password ? { password } : {}), peer: this.id! },
        message => {
          if (message.meta.network !== network) return undefined;
          if (message.meta.type === NetworkType.Reject)
          {
            throw new Error(`rejected: ${(message.payload as PayloadMap[NetworkType.Reject]).reason}`);
          }
          return message.meta.type === NetworkType.MergeAccept ? message.payload : undefined;
        },
      );
      if ((this.merging as Merge | null) !== merge) throw new Error("the merge was cancelled");

      this.bridge(merge, accept.peer, accept.size);
      this.router!.setSocket(accept.peer, accept.socket);
      this.link(accept.peer);
      return await merge.done;
    }
    catch (error)
    {
      if (this.merging === merge) this.endMerge(error as Error);
      throw error;
    }
  }

  private startMerge() {
    let resolve!: Merge["resolve"];
    let reject!: Merge["reject"];
    const done = new Promise<NetworkInfo>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    done.catch(() => { });

    const merge: Merge = {
      peer: "",
      size: this.members.length,
      stays: false,
      done,
      resolve,
      reject,
      timer: setTimeout(() => this.endMerge(new Error("merge timed out")), MERGE_TIMEOUT),
    };
    this.merging = merge;
    return merge;
  }

  // both hosts work out the same answer
  private bridge(merge: Merge, peer: PeerId, size: number) {
    merge.peer = peer;
    merge.stays = merge.size > size || (merge.size === size && this.id! < peer);
    this.router!.bridge = peer;
  }

  /** Ends the current merge: with `error` it's off, and the host link goes. */
  private endMerge(error?: Error, network?: NetworkInfo) {
    const merge = this.merging;
    if (!merge) return;

    this.merging = null;
    clearTimeout(merge.timer);
    if (!error) return void merge.resolve(network!);

    const router = this.router!;
    if (router.bridge)
    {
      this.pending.get(router.bridge)?.close();
      router.removeLink(router.bridge);
      router.bridge = null;
    }
    merge.reject(error);
  }

  private sendMergeList(peer: PeerId) {
    this.sendReserved(peer, NetworkType.MergeList, {
      network: this.network!,
      members: this.order(),
      profiles: this.profiles,
      ...this.serverField(),
      ...(this.password ? { password: this.password } : {}),
    });
  }

  /**
   * Gives every peer the new list at once. Each works out for itself what changes, so nothing needs
   * coordinating from here on and a host dying later doesn't stop anything.
   */
  private unite(view: PayloadMap[NetworkType.MergeView], other?: PeerId) {
    const router = this.router!;
    const previous = router.view.host;
    const group = new Set(router.view.members);
    const { network, members, profiles, serverId, password } = view;

    router.split = {
      gateway: other ?? previous,
      foreign: new Set(members.filter(member => !group.has(member))),
      led: !!other,
    };
    router.bridge = null;
    this.network = network;
    router.info = network;
    router.setMembers(members, network.host);
    this.password = password;
    this.setServerId(serverId ?? network.id);
    this.profileMap = new Map(Object.entries(profiles ?? {}));
    this.profileMap.set(this.id!, this.ownProfile);
    if (JSON.stringify(network.media ?? {}) !== JSON.stringify(this.media.plan)) this.media.setPlan(network.media);

    this.emitMembers();
    if (network.host !== previous) this.emit("host", network.host);
    if (other) this.emit("peer", other);
    this.emit("merged", network);
    this.startPace();
  }

  private startPace() {
    this.stopPace();
    const delay = Math.random() * this.members.length * MERGE_PACE;
    const pace: Pace = {
      start: setTimeout(() => {
        pace.start = null;
        this.reconcile();
      }, delay),
      settle: null,
      limit: setTimeout(() => this.finishPace(), MERGE_LIMIT),
    };
    this.pace = pace;
  }

  private stopPace() {
    const pace = this.pace;
    if (!pace) return;

    this.pace = null;
    if (pace.start !== null) clearTimeout(pace.start);
    if (pace.settle !== null) clearTimeout(pace.settle);
    clearTimeout(pace.limit);
  }

  /** Every wanted link is up, or the time is: the old links nobody wants go, and the merge is over for this peer. */
  private finishPace() {
    const router = this.router;
    this.stopPace();
    if (!router) return;

    router.split = null;
    this.prune();
    this.dropSocket();
  }

  // asks the other side to close the links neither wants: a change of members can leave some behind
  private prune() {
    for (const peer of this.router!.view.links)
    {
      if (this.wanted(peer)) continue;
      this.pruned.add(peer);
      this.sendReserved(peer, NetworkType.Prune, {});
    }
  }

  private tidy() {
    const router = this.router;
    if (!router || this.tidyTimer !== null || !router.view.links.some(peer => !this.wanted(peer))) return;

    this.tidyTimer = setTimeout(() => {
      this.tidyTimer = null;
      if (this.pace || !this.network) return;
      if (router.desired().length > 0 || this.pending.size > 0) return this.tidy();
      this.prune();
    }, LINK_SETTLE);
  }

  // either side of the pair wants the link
  private wanted(peer: PeerId) {
    const router = this.router!;
    const view = router.view;
    return view.members.includes(peer) && (router.topology.neighbors(view, this.id!).includes(peer) || router.topology.neighbors(view, peer).includes(this.id!));
  }

  // a host without a socket: opens one, which registers the network again
  private reopen() {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeEventListener("server-id", handle);
        reject(new Error("could not reach the server"));
      }, this.options.timeout ?? REQUEST_TIMEOUT);
      const handle = () => {
        clearTimeout(timer);
        resolve();
      };
      this.addEventListener("server-id", handle, { once: true });
      this.recreate();
    });
  }

  /**
   * Opens a network on top of this one, with no socket and nothing registered on the server. This peer
   * hosts it. Others join with `joinRoom(room.network.id, room.host)`, so send them those in a message.
   */
  async room(options: RoomOptions): Promise<Client> {
    await this.ready;
    if (!this.network) throw new Error("not in a network");

    const { name, password, meta, media, topology = "mesh" } = options;
    const room = this.openRoom(crypto.randomUUID(), options);
    const id = this.id!;
    room.password = password;
    room.profileMap = new Map([[id, room.ownProfile]]);
    room.enter({ id: room.roomId, name, host: id, topology, private: true, size: 1, ...(meta ? { meta } : {}), ...(media ? { media } : {}) }, [id], id);
    return room;
  }

  /** Joins a room through its `host`, over this network. Rejects on a reject or a timeout. */
  async joinRoom(id: string, host: PeerId, password?: string): Promise<Client> {
    await this.ready;
    if (!this.network) throw new Error("not in a network");
    if (this.rooms.has(id)) throw new Error("already in that room");

    const room = this.openRoom(id, {});
    try
    {
      await room.enterVia(id, password, host);
      return room;
    }
    catch (error)
    {
      room.close();
      throw error;
    }
  }

  private openRoom(id: string, options: Partial<RoomOptions>) {
    const { topology, accept, profile = this.ownProfile } = options;
    const room = new Client({ ...this.options, topology, accept, profile, recreate: false }, { client: this, room: id });
    this.rooms.set(id, room);
    return room;
  }

  private assertOnServer() {
    if (this.parent) throw new Error("a room isn't on the server, open it with room() or joinRoom()");
  }

  // sends a room's message to a peer over this network
  private carry(room: string, receiver: PeerId, message: string) {
    if (!this.network || !this.rooms.has(room) || this.id !== this.rooms.get(room)!.id) return false;
    return this.sendReserved(receiver, NetworkType.Room, { room, message }, true);
  }

  /** Sends an app message to one peer. Reserved types emit `"error"` instead. */
  send(receiver: PeerId, type: string, payload: unknown = {}) {
    if (!this.router || isReserved(type))
    {
      this.error("send", isReserved(type) ? `"${type}" is a reserved type` : "not connected", { type });
      return false;
    }

    return this.router.send(Message.Create({ type, sender: this.id!, receiver, network: this.network?.id }, payload as object));
  }

  /** Sends an app message to every member. */
  broadcast(type: string, payload: unknown = {}) {
    return this.send(BROADCAST, type, payload);
  }

  /** Leaves the network: tells the server and the peers, then closes every peer link. */
  leave() {
    const network = this.network;
    const router = this.router;
    if (!network || !router) return;

    this.parent?.rooms.delete(this.roomId);
    this.endMerge(new Error("left the network"));
    this.stopPace();
    router.split = null;
    this.pruned.clear();
    if (this.tidyTimer !== null) clearTimeout(this.tidyTimer);
    this.tidyTimer = null;
    this.signal(SignalType.Leave, { network: this.serverNetwork ?? network.id });
    this.serverNetwork = null;
    this.password = undefined;
    this.clearRegisterTimer();
    this.sendReserved(BROADCAST, NetworkType.Leave, { peer: this.id! });

    this.network = null;
    router.info = undefined;
    this.media.setPlan(undefined);
    for (const peer of [...this.retries.keys()]) this.clearRetry(peer);
    for (const peer of [...this.lost.keys()]) this.clearLost(peer);
    for (const link of this.pending.values()) link.close();
    this.pending.clear();
    for (const peer of router.view.links) router.removeLink(peer);
    router.setMembers([]);
    this.profileMap.clear();
    this.emitMembers();
    if (this.reassigned) this.adopt(this.reassigned);
  }

  // takes the id the server assigned after a reconnect, so later messages carry it
  private adopt(id: PeerId) {
    this.debug("socket", "taking the id the server assigned after a reconnect", { previous: this.id, id });
    this.reassigned = null;
    this.id = id;
    this.router!.rename(id);
  }

  /** Leaves, closes the socket and any rooms, and rejects pending requests. */
  close() {
    if (this.closed) return;
    this.closed = true;

    for (const room of [...this.rooms.values()]) room.close();
    this.parent?.rooms.delete(this.roomId);
    this.leave();
    this.stopWake();
    if (this.wakingTimer !== null) clearTimeout(this.wakingTimer);
    this.wakingTimer = null;
    this.media.close();
    this.media.removeEventListener("error", this.handleForward);
    this.media.removeEventListener("debug", this.handleForward);
    for (const request of [...this.requests]) this.settle(request, undefined, new Error("client closed"));

    if (this.socket)
    {
      this.socket.removeEventListener("welcome", this.handleWelcome);
      this.socket.removeEventListener("disconnect", this.handleDisconnect);
      this.socket.removeEventListener("open", this.handleSocketOpen);
      this.socket.close();
      this.socket.removeEventListener("close", this.handleSocketClose);
      this.socket.removeEventListener("error", this.handleForward);
      this.socket.removeEventListener("debug", this.handleForward);
    }
    else this.setStatus("closed");

    if (this.router)
    {
      this.detachRouter(this.router);
      this.router.close();
    }
  }

  // network bookkeeping
  private enter(network: NetworkInfo, members: PeerId[], host: PeerId) {
    const router = this.router!;
    this.network = network;
    router.info = network;
    router.topology = resolveTopology(network.topology, error => this.error("topology", `${error.message}, falling back to mesh`, network.topology));
    router.setMembers(members, host);
    this.media.setPlan(network.media);

    this.emitMembers();
    this.emit("host", router.view.host);
  }

  private link(peer: PeerId, offer?: Offer) {
    const router = this.router;
    if (!router || this.pending.has(peer) || router.view.links.includes(peer)) return;

    const link = new PeerLink(this.id!, peer, router, { rtc: this.options.rtc, timeout: this.options.linkTimeout });
    this.pending.set(peer, link);
    this.media.attach(link);

    const cleanup = () => {
      link.removeEventListener("open", handleOpen);
      link.removeEventListener("close", handleClose);
      link.removeEventListener("error", this.handleForward);
      link.removeEventListener("debug", this.handleForward);
    };
    const handleOpen = () => {
      if (this.pending.get(peer) === link) this.pending.delete(peer);
      if (!this.network) return void link.close();
      this.clearRetry(peer);
      this.clearLost(peer);

      router.addLink(link);
      this.dropSocket();
      if (this.pace) this.reconcile();
    };
    const handleClose = () => {
      cleanup();
      if (this.pending.get(peer) !== link) return;
      this.pending.delete(peer);
      if (this.merging?.peer === peer) return void this.endMerge(new Error("could not link to the other host"));
      this.debug("link", `link to ${peer} closed before it opened (${link.connection.connectionState})`, { peer });
      this.retry(peer);
      if (this.pace) this.reconcile();
    };

    link.addEventListener("open", handleOpen);
    link.addEventListener("close", handleClose);
    link.addEventListener("error", this.handleForward);
    link.addEventListener("debug", this.handleForward);

    this.debug("link", `${offer ? "answering" : "offering"} ${peer}`, { peer });
    link.connect(offer);
  }

  /** Tries a failed link again after a delay. Only the side that opens the link retries, unless forced; the other answers. */
  private retry(peer: PeerId, force = false) {
    const router = this.router;
    if (!router || !this.network || !router.view.members.includes(peer)) return;
    if (!force && !this.retries.has(peer) && !this.initiates(peer)) return;

    const retry = this.retries.get(peer) ?? { attempts: 0, timer: null };
    if (retry.timer !== null) return;
    if (retry.attempts >= LINK_RETRIES)
    {
      this.clearRetry(peer);
      this.error("link", `gave up on the link to ${peer} after ${LINK_RETRIES} retries`, { peer });
      return;
    }

    retry.attempts++;
    this.retries.set(peer, retry);
    this.debug("link", `retrying the link to ${peer} (attempt ${retry.attempts} of ${LINK_RETRIES})`, { peer });
    retry.timer = setTimeout(() => {
      retry.timer = null;
      if (this.router?.desired().includes(peer)) this.link(peer);
      else this.clearRetry(peer);
    }, retry.attempts * LINK_RETRY_DELAY);
  }

  private clearRetry(peer: PeerId) {
    const retry = this.retries.get(peer);
    if (retry?.timer != null) clearTimeout(retry.timer);
    this.retries.delete(peer);
  }

  /**
   * A link to a wanted member dropped without a `network.leave`: both may still be online, so the
   * member stays while the link is tried again. False when there's nothing to wait for.
   */
  private hold(peer: PeerId) {
    const router = this.router;
    if (!router || !this.network || !router.view.members.includes(peer) || !router.desired().includes(peer)) return false;
    if (this.lost.has(peer)) return true;

    this.lost.set(peer, setTimeout(() => {
      this.debug("link", `no link to ${peer} in time, dropping the member`, { peer });
      this.forget(peer);
      this.pending.get(peer)?.close();
    }, (this.options.linkTimeout ?? HANDSHAKE_TIMEOUT) + LINK_RETRY_DELAY));

    // no socket and no peer route to the host: the server is the only way back, and only this side can use it
    const stranded = this.dropped && !this.parent && peer === router.view.host && router.topology.route(router.view, { receiver: peer, hops: [this.id!] } as Meta).length === 0;
    if (stranded) this.recreate();
    this.retry(peer, stranded);
    return true;
  }

  private clearLost(peer: PeerId) {
    const timer = this.lost.get(peer);
    if (timer !== undefined) clearTimeout(timer);
    this.lost.delete(peer);
  }

  /**
   * Exactly one side of a pair opens the link: the lower id, unless only one side wants it.
   * Avoiding glare on the first offer matters: rolling it back discards the data channels.
   */
  private initiates(peer: PeerId) {
    const router = this.router!;
    const wanted = router.topology.neighbors(router.view, peer).includes(this.id!);
    return this.id! < peer || !wanted;
  }

  /** Opens the links the topology wants that this side initiates. */
  private reconcile() {
    const router = this.router;
    if (!router || !this.network) return;

    this.media.refresh();
    if (this.pace) return this.paceLinks();
    for (const peer of router.desired())
    {
      if (!this.pending.has(peer) && this.initiates(peer)) this.link(peer);
    }
    this.tidy();
  }

  // after a merge: the links that make routing work first, then the rest a few at a time
  private paceLinks() {
    const router = this.router!;
    const pace = this.pace!;
    if (pace.start !== null) return;

    const desired = router.desired();
    if (desired.length === 0 && this.pending.size === 0)
    {
      pace.settle ??= setTimeout(() => this.finishPace(), LINK_SETTLE);
      return;
    }

    const mine = desired.filter(peer => !this.pending.has(peer) && this.initiates(peer));
    const stitch = router.topology.stitch?.(router.view, this.id!).filter(peer => mine.includes(peer)) ?? [];
    const next = stitch.length > 0 ? stitch : mine;
    for (const peer of next.slice(0, Math.max(0, MERGE_LINKS - this.pending.size))) this.link(peer);
  }

  /**
   * Sends the member list to every other member, one by one: a peer this node has no route to yet
   * (a new star hub, say) still gets it through the server.
   */
  private broadcastMembers(except?: PeerId) {
    const router = this.router;
    if (!router || !this.network) return;

    const members = this.order();
    for (const member of members)
    {
      if (member === this.id || member === except) continue;
      this.sendReserved(member, NetworkType.Members, { members, host: router.view.host, profiles: this.profiles, ...this.serverField() });
    }
  }

  private emitMembers() {
    this.emit("members", { members: [...(this.router?.view.members ?? [])], profiles: this.profiles });
  }

  private setStatus(status: ClientStatus) {
    if (this._status === status || this._status === "closed") return;
    this._status = status;
    if (status === "connected" || status === "closed") this.stopWake();
    else this.startWake();
    this.emit("status", status);
  }

  /** Pings `/health` while not connected, so a sleeping host starts booting. Errors are ignored. */
  private startWake() {
    if (this.options.wake === false || this.wakeTimer !== null || this.closed) return;

    let url: string;
    try
    {
      url = `${httpUrl(this.options.url)}/health`;
    }
    catch
    {
      return;
    }

    const ping = () => {
      fetch(url, { cache: "no-store" }).catch(() => { });
    };
    ping();
    this.wakeTimer = setInterval(ping, WAKE_INTERVAL);
  }

  private stopWake() {
    if (this.wakeTimer !== null) clearInterval(this.wakeTimer);
    this.wakeTimer = null;
  }

  // no socket but in need of one: the new host's welcome registers the network again, a stranded member offers to the host
  private recreate() {
    this.debug("socket", "opening the signalling socket again", null);
    this.dropped = false;
    this.socket = this.openSocket();
  }

  /**
   * Registers the network again under a new server id (host only) and tells the members. Joins for it
   * are answered with the network's own id. A new host does this by itself, with retries; call it
   * after an `"error"` of type `"host"`. Resolves with the new `serverId`.
   */
  async reregister(): Promise<string> {
    this.assertOnServer();
    const network = this.network;
    if (!network) throw new Error("not in a network");
    if (this.host !== this.id) throw new Error("only the host can register the network");

    const registered: NetworkInfo = await this.request(
      SignalType.Register,
      { name: network.name, topology: network.topology, private: network.private, ...(this.password ? { password: this.password } : {}), ...(network.meta ? { meta: network.meta } : {}), ...(network.media ? { media: network.media } : {}) },
      message => message.meta.type === SignalType.Registered ? (message.payload as PayloadMap[SignalType.Registered]).network : undefined,
    );
    if (this.network?.id !== network.id) throw new Error("left the network");

    this.setServerId(registered.id);
    this.broadcastMembers();
    return registered.id;
  }

  private register(attempt = 0) {
    this.clearRegisterTimer();
    this.reregister().catch((error) => {
      if (!this.network || this.closed) return;
      if (attempt >= LINK_RETRIES) return void this.error("host", "could not register the network again", error);

      this.debug("host", `retrying to register the network (attempt ${attempt + 1} of ${LINK_RETRIES})`, error);
      this.registerTimer = setTimeout(() => this.register(attempt + 1), (attempt + 1) * LINK_RETRY_DELAY);
    });
  }

  private clearRegisterTimer() {
    if (this.registerTimer !== null) clearTimeout(this.registerTimer);
    this.registerTimer = null;
  }

  private setServerId(id: string) {
    if (id === this.serverId) return;
    this.serverNetwork = id;
    this.emit("server-id", id);
  }

  // only when it differs from the network's id
  private serverField() {
    return this.serverNetwork ? { serverId: this.serverNetwork } : {};
  }

  private dropSocket() {
    if (this.draining || !this.socketDroppable()) return;

    // a closing socket drops what's arriving, so the server stops first: whoever sends now hears it can't be delivered
    this.draining = true;
    const drained = (done: boolean) => {
      this.draining = false;
      if (this.closed) return;
      if (this.socketDroppable())
      {
        this.debug("socket", "closing the signalling socket, keepSocket lets it go", done);
        this.dropped = true;
        this.socket!.close();
      }
      else if (done) this.signal(SignalType.Drain, { draining: false });
    };
    this.request<boolean>(SignalType.Drain, { draining: true }, message => message.meta.type === SignalType.Drained ? true : undefined).then(drained, () => drained(false));
  }

  private socketDroppable() {
    const keep = this.options.keepSocket ?? "host";
    if (keep === true || !this.network || this.pending.size > 0 || !this.socket || this.dropped || this.merging || this.pace) return false;
    return keep !== "host" || this.router?.view.host !== this.id;
  }

  // sending helpers
  private sendReserved<T extends keyof PayloadMap>(receiver: PeerId, type: T, payload: PayloadMap[T], preferServer = false, network = this.network?.id) {
    return this.router?.send(Message.Create({ type, sender: this.id!, receiver, network }, payload), { preferServer }) ?? false;
  }

  private signal<T extends keyof PayloadMap>(type: T, payload: PayloadMap[T]) {
    const message = Message.Create({ type, sender: this.router?.socketId ?? this.id!, receiver: SERVER }, payload);
    if (!this.dropped) this.router?.send(message);
    return message;
  }

  private request<T>(type: SignalType, payload: object, match: (message: Message) => unknown, send = () => this.signal(type as keyof PayloadMap, payload as any)) {
    return new Promise<T>((resolve, reject) => {
      const message = send();
      const request: Request = {
        id: message.meta.id,
        match,
        resolve,
        reject,
        timer: setTimeout(() => this.settle(request, undefined, new Error(`${type} timed out`)), this.options.timeout ?? REQUEST_TIMEOUT),
      };
      this.requests.push(request);
    });
  }

  private settle(request: Request, value: unknown, error?: Error) {
    const index = this.requests.indexOf(request);
    if (index < 0) return;

    this.requests.splice(index, 1);
    clearTimeout(request.timer);
    if (error) request.reject(error);
    else request.resolve(value);
  }

  /** True when a pending request consumed the message. */
  private answer(message: Message) {
    const { type } = message.meta;
    for (const request of [...this.requests])
    {
      if (type === SignalType.Error || type === SignalType.Unreachable)
      {
        const payload = message.payload as PayloadMap[SignalType.Error] & PayloadMap[SignalType.Unreachable];
        if (payload.ref !== request.id) continue;

        const reason = type === SignalType.Error ? `${payload.code}: ${payload.message}` : `unreachable: ${payload.receiver || "no entry peer"}`;
        this.settle(request, undefined, new Error(reason));
        return true;
      }

      try
      {
        const value = request.match(message);
        if (value === undefined) continue;
        this.settle(request, value);
        return true;
      }
      catch (error)
      {
        this.settle(request, undefined, error as Error);
        return true;
      }
    }
    return false;
  }

  // router
  private attachRouter(router: Network) {
    router.addEventListener("message", this.handleMessage);
    router.addEventListener("link", this.handleLink);
    router.addEventListener("unlink", this.handleUnlink);
    router.addEventListener("unreachable", this.handleUnreachable);
    router.addEventListener("drop", this.handleForward);
    router.addEventListener("error", this.handleForward);
    router.addEventListener("debug", this.handleForward);
  }

  private detachRouter(router: Network) {
    router.removeEventListener("message", this.handleMessage);
    router.removeEventListener("link", this.handleLink);
    router.removeEventListener("unlink", this.handleUnlink);
    router.removeEventListener("unreachable", this.handleUnreachable);
    router.removeEventListener("drop", this.handleForward);
    router.removeEventListener("error", this.handleForward);
    router.removeEventListener("debug", this.handleForward);
  }

  // incoming
  private handleJoin(message: Message) {
    const network = this.network;
    const router = this.router!;
    const newcomer = message.meta.sender;
    const asked = message.meta.network;
    if (!network || (asked !== network.id && asked !== this.serverNetwork) || !newcomer || newcomer === this.id) return;

    if (this.options.accept && !this.options.accept(newcomer, network))
    {
      this.sendReserved(newcomer, NetworkType.Reject, { reason: "not accepted" }, true, asked);
      return;
    }

    // the hosts are swapping member lists, a newcomer would miss one of them
    if (this.merging)
    {
      this.sendReserved(newcomer, NetworkType.Reject, { reason: "merging" }, true, asked);
      return;
    }

    const { profile, password } = message.payload as PayloadMap[NetworkType.Join];
    // no server checked this newcomer
    if (this.parent && (router.view.host !== this.id || (this.password && password !== this.password)))
    {
      this.sendReserved(newcomer, NetworkType.Reject, { reason: router.view.host !== this.id ? "not the host" : "wrong password" }, true, asked);
      return;
    }

    const existing = router.view.members.length > 1;
    this.profileMap.set(newcomer, profile ?? {});
    router.setMembers([...this.order(), newcomer]);
    const view = router.view;
    const members = this.order();
    this.network = { ...network, size: members.length };
    router.info = this.network;

    this.sendReserved(newcomer, NetworkType.Welcome, {
      network: this.network,
      members,
      connect: router.topology.neighbors(view, newcomer),
      profiles: this.profiles,
    }, true, asked);
    if (existing) this.broadcastMembers(newcomer);

    this.emitMembers();
    this.reconcile();
  }

  private handleMembers(message: Message) {
    const router = this.router!;
    const payload = message.payload as PayloadMap[NetworkType.Members];
    const sender = message.meta.sender;
    if (!this.network || message.meta.network !== this.network.id) return;
    if (sender !== router.view.host && payload.host !== sender) return; // only the host sets the members
    if (payload.serverId) this.setServerId(payload.serverId);

    const previous = router.view.host;
    const host = payload.host ?? previous;
    router.setMembers(payload.members, host);
    this.network = { ...this.network, host, size: router.view.members.length };
    router.info = this.network;
    if (payload.profiles)
    {
      this.profileMap = new Map(Object.entries(payload.profiles).filter(([id]) => router.view.members.includes(id)));
      this.profileMap.set(this.id!, this.ownProfile);
    }

    this.emitMembers();
    if (host !== previous) this.emit("host", host);
    this.reconcile();
  }

  private handleLeave(message: Message) {
    const router = this.router!;
    const { peer } = message.payload as PayloadMap[NetworkType.Leave];
    if (!this.network || message.meta.network !== this.network.id || peer !== message.meta.sender) return;

    this.forget(peer);
    this.pending.get(peer)?.close();
    router.removeLink(peer);
  }

  /** The host records a member's own profile and shares it. */
  private handleProfile(message: Message) {
    const router = this.router!;
    const sender = message.meta.sender;
    if (!this.network || message.meta.network !== this.network.id) return;
    if (router.view.host !== this.id || !router.view.members.includes(sender)) return;

    this.profileMap.set(sender, (message.payload as PayloadMap[NetworkType.Profile]).profile);
    this.broadcastMembers();
    this.emitMembers();
  }

  private handleMedia(message: Message) {
    const router = this.router!;
    if (!this.network || message.meta.network !== this.network.id) return;
    if (message.meta.sender !== router.view.host) return; // only the host sets the plan

    const { media } = message.payload as PayloadMap[NetworkType.Media];
    this.network = { ...this.network, media };
    router.info = this.network;
    this.media.setPlan(media);
  }

  private handleHost(message: Message) {
    const router = this.router!;
    const { network } = message.payload as PayloadMap[SignalType.Host];
    if (!this.network || network.id !== this.network.id) return;

    this.network = network;
    router.info = network;
    router.setMembers(this.order(), this.id!);
    this.profileMap.set(this.id!, this.ownProfile);
    if (JSON.stringify(network.media ?? {}) !== JSON.stringify(this.media.plan)) this.media.setPlan(network.media);
    this.emit("host", this.id);
    this.broadcastMembers();
    this.reconcile();
  }

  private handleMerge(message: Message) {
    const router = this.router!;
    const { network, size, password, peer = message.meta.sender } = message.payload as PayloadMap[NetworkType.Merge];
    const asked = message.meta.network;
    const own = this.network;
    // the requester may not be known by its peer id yet, so a refusal goes to its socket
    const reject = (reason: string) => void this.sendReserved(message.meta.sender, NetworkType.Reject, { reason }, true, asked);

    if (!own || this.parent || (asked !== own.id && asked !== this.serverNetwork) || router.view.host !== this.id) return reject("not the host");
    if (!this.options.acceptMerge?.(network, size)) return reject("not accepted");
    if (this.password && password !== this.password) return reject("wrong password");
    if (JSON.stringify(network.topology) !== JSON.stringify(own.topology)) return reject("different topology");
    // both hosts asked at once: the lower id's request goes first
    if (this.merging && (this.merging.peer || this.id! < peer)) return reject("merging");
    if (this.merging) this.endMerge(new Error("rejected: merging"));

    router.setSocket(peer, message.meta.sender);
    const merge = this.startMerge();
    this.bridge(merge, peer, size);
    this.sendReserved(peer, NetworkType.MergeAccept, { peer: this.id!, socket: router.socketId, size: merge.size }, true, asked);
  }

  /** The other host's list: both groups' peers get the union, each from their own host. */
  private handleMergeList(message: Message) {
    const router = this.router!;
    const merge = this.merging;
    if (!merge || !this.network || message.meta.sender !== merge.peer) return;

    const list = message.payload as PayloadMap[NetworkType.MergeList];
    const group = this.order();
    const incoming = list.members.filter(member => !group.includes(member));
    const staying = merge.stays
      ? { network: this.network, serverId: this.serverId!, password: this.password }
      : { network: list.network, serverId: list.serverId ?? list.network.id, password: list.password };
    const members = merge.stays ? [...group, ...incoming] : [...list.members, ...group.filter(member => !list.members.includes(member))];

    const view: PayloadMap[NetworkType.MergeView] = {
      network: { ...staying.network, host: merge.stays ? this.id! : merge.peer, size: members.length },
      members,
      profiles: { ...this.profiles, ...list.profiles },
      serverId: staying.serverId,
      ...(staying.password ? { password: staying.password } : {}),
    };

    for (const member of group)
    {
      if (member !== this.id) this.sendReserved(member, NetworkType.MergeView, view);
    }
    if (!merge.stays) this.signal(SignalType.Unregister, { network: this.serverId! });

    this.endMerge(undefined, view.network);
    this.unite(view, merge.peer);
    this.reconcile();
  }

  private handleMergeView(message: Message) {
    if (!this.network || message.meta.network !== this.network.id || message.meta.sender !== this.router!.view.host) return;

    this.unite(message.payload as PayloadMap[NetworkType.MergeView]);
    this.reconcile();
  }

  /** The other side is done with this link. While still linking up it may be my route, so I send my own prune when I'm done. */
  private handlePrune(message: Message) {
    const router = this.router!;
    const peer = message.meta.sender;
    if (this.pace || this.wanted(peer)) return;

    this.pruned.add(peer);
    router.removeLink(peer);
  }

  private handleRoom(message: Message) {
    const { room, message: carried } = message.payload as PayloadMap[NetworkType.Room];
    this.rooms.get(room)?.router?.receive(carried, message.meta.sender);
  }

  /** A new session from a linked peer means its end of the link is gone: ours goes too, and the offer opens a new one. */
  private handleOffer(message: Message) {
    if (!this.network && !this.joining) return;

    const peer = message.meta.sender;
    const offer = message.payload as Offer;
    const pending = this.pending.get(peer);
    const link = pending ?? this.router!.link(peer);
    const remote = link instanceof PeerLink ? link.handshake.remoteSession : null;
    // two offers crossed: if both sides gave up theirs, both would answer a closed connection. The lower id's stands
    if (pending && !remote && this.id! < peer && performance.now() - pending.opened < LINK_RETRY_DELAY) return;
    // an older unanswered offer of ours goes too: the other side only offers when it can't be reached
    if ((remote || pending) && offer.session && offer.session !== remote)
    {
      this.debug("link", `${peer} opened a new connection, replacing the old link`, { peer });
      if (pending) pending.close();
      else this.router!.removeLink(peer);
    }

    if (!this.pending.has(peer)) this.link(peer, offer);
  }

  /** Drops a member that left or lost its link, then repairs the topology. */
  private forget(peer: PeerId) {
    this.clearLost(peer);
    this.clearRetry(peer);
    const router = this.router;
    if (!router || !this.network || !router.view.members.includes(peer)) return;

    // the way to the other group died before any link crossed: the groups go on apart
    const split = router.split;
    const lostGateway = peer === split?.gateway;
    const cut = lostGateway && !router.view.links.some(link => link !== peer && split.foreign.has(link));
    if (lostGateway) router.split = null;

    const rest = this.order().filter(member => member !== peer && !(cut && split.foreign.has(member)));
    // the host left: everyone picks the same successor, the lowest id. A host cut off keeps its group, it has the socket
    const lostHost = !rest.includes(router.view.host);
    const host = !lostHost ? router.view.host : cut && split.led ? this.id! : [...rest].sort()[0];
    router.setMembers(rest, host);
    this.profileMap.delete(peer);
    if (cut) for (const member of split.foreign) this.profileMap.delete(member);
    this.network = { ...this.network, host, size: router.view.members.length };
    router.info = this.network;
    this.emitMembers();
    if (lostHost) this.emit("host", host);

    if (router.view.host === this.id)
    {
      this.broadcastMembers();
      // the server dropped the network with its host: register it again (opening a socket first if needed)
      if (lostHost && this.options.recreate !== false)
      {
        if (this.dropped) this.recreate();
        else this.register();
      }
    }
    this.reconcile();
  }

  // event handlers
  private handleWelcome = (event: Event) => {
    const id = (event as CustomEvent<PeerId>).detail;
    if (this.router)
    {
      this.setStatus("connected");
      this.router.addLink(this.socket!);
      if (id === this.router.socketId) return;
      if (this.network)
      {
        // the peer id stays; the server knows us by the new socket id from now on
        this.reassigned = id;
        this.router.socketId = id;
        if (this.router.view.host === this.id) this.register();
        return;
      }
      this.adopt(id);
      return;
    }

    this.connectedOnce = true;
    this.id = id;
    this.router = new Network({ me: id, topology: this.options.topology });
    this.attachRouter(this.router);
    this.router.addLink(this.socket!);
    this.setStatus("connected");
  }

  private handleMessage = (event: Event) => {
    const message = (event as CustomEvent<Message>).detail;
    const { meta } = message;

    try
    {
      if (this.answer(message)) return;

      switch (meta.type)
      {
        case SignalType.Welcome:
        case SignalType.Registered:
        case SignalType.Drained:
        case SignalType.Networks:
        case NetworkType.Welcome:
        case NetworkType.Reject:
        case NetworkType.MergeAccept:
          return; // replies to requests no longer pending
        case SignalType.Host: return this.handleHost(message);
        case SignalType.Unreachable: return void this.emit("unreachable", message.payload);
        case SignalType.Error: return void this.error("server", (message.payload as PayloadMap[SignalType.Error]).message, message.payload);
        case NetworkType.Join: return this.handleJoin(message);
        case NetworkType.Members: return this.handleMembers(message);
        case NetworkType.Leave: return this.handleLeave(message);
        case NetworkType.Media: return this.handleMedia(message);
        case NetworkType.Profile: return this.handleProfile(message);
        case NetworkType.Room: return this.handleRoom(message);
        case NetworkType.Merge: return this.handleMerge(message);
        case NetworkType.MergeList: return this.handleMergeList(message);
        case NetworkType.MergeView: return this.handleMergeView(message);
        case NetworkType.Prune: return this.handlePrune(message);
        case HandshakeType.Offer: return this.handleOffer(message);
      }

      if (isReserved(meta.type)) return; // handshake answers/candidates are handled by their PeerLink

      const detail: ClientMessage = { type: meta.type, sender: meta.sender, payload: message.parse(), meta };
      this.emit("message", detail);
    }
    catch (error)
    {
      this.error("message", `failed to handle ${meta.type} from ${meta.sender}`, error);
    }
  }

  private handleLink = (event: Event) => {
    const id = (event as CustomEvent<PeerId>).detail;
    if (id === SERVER) return;
    if (id === this.router?.bridge) return this.sendMergeList(id);

    this.emit("peer", id);

    // a host's members broadcast can miss peers it had no route to yet (e.g. a new star hub)
    const router = this.router;
    if (router && this.network && router.view.host === this.id)
    {
      this.sendReserved(id, NetworkType.Members, { members: this.order(), host: this.id, ...this.serverField() });
    }
  }

  private handleUnlink = (event: Event) => {
    const id = (event as CustomEvent<PeerId>).detail;
    if (id === SERVER) return;
    // the host link: a merge in progress is off, the groups never saw each other
    if (id === this.router?.bridge) return this.endMerge(new Error("lost the other host"));

    this.emit("peer-left", id);
    if (this.pruned.delete(id)) return;
    if (id === this.router?.split?.gateway) return this.forget(id);
    if (!this.hold(id)) this.forget(id);
  }

  private handleUnreachable = (event: Event) => {
    const { meta } = (event as CustomEvent<Message>).detail;
    this.emit("unreachable", { receiver: meta.receiver, ref: meta.id });
  }

  private handleDisconnect = (event: Event) => {
    this.debug("socket", "signalling socket dropped, reconnecting", (event as CustomEvent).detail);
    if (this.connectedOnce) this.setStatus("reconnecting");
  }

  private handleSocketOpen = () => {
    this.debug("socket", "signalling socket open", null);
  }

  private handleSocketClose = () => {
    if (!this.closed) this.debug("socket", "signalling socket closed", null);
    if (this.wakingTimer !== null) clearTimeout(this.wakingTimer);
    this.wakingTimer = null;
    if (this.dropped && !this.closed) return; // still in the network, just without a socket
    this.setStatus("closed");
  }

  // re-emits error/debug/drop from the socket, router and links
  private handleForward = (event: Event) => {
    this.emit(event.type, (event as CustomEvent).detail);
  }
}
