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
import type { Offer } from "./components/handshake";
import { PeerLink } from "./components/peer";
import { SocketLink } from "./components/socket";
import { resolveTopology } from "./components/topology";

/** How long `create`, `list` and `join` wait for the server or the entry peer. */
export const REQUEST_TIMEOUT = 15_000;
/** How long the first connection may fail before the status turns `"waking"`. */
export const WAKING_AFTER = 3_000;
/** ms between `/health` pings while not connected. */
export const WAKE_INTERVAL = 4_000;

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
  /** ms before `create`, `list` and `join` reject. */
  timeout?: number;
  /** ms without a server connection before giving up for good (`ready` rejects). Default: keep trying. */
  connectTimeout?: number;
  /** While not connected, ping `<http url>/health` every few seconds so a sleeping host boots. Default true. */
  wake?: boolean;
  /** What this peer says about itself, e.g. `{ name }`. At most 1 KB as JSON. */
  profile?: Profile;
  /** Becoming host without a socket opens a new one and registers the network again, so others can still join. Default true. */
  recreate?: boolean;
}

/** Detail of the client's `"message"` event. */
export type ClientMessage<Payload = unknown> = {
  type: string;
  sender: PeerId;
  payload: Payload;
  meta: Meta;
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
 * @fires unreachable - `CustomEvent<{ receiver, ref }>`, a message could not be delivered
 * @fires drop - `CustomEvent<Message>`, a received message was dropped (loop, ttl, filter)
 * @fires error - `CustomEvent<EmitterEvent>`
 * @fires debug - `CustomEvent<EmitterEvent>`
 *
 * Media (streams, channels) lives on `client.media`, see `Media`.
 */
export class Client extends Emitter {
  /** This peer's id, null until the server welcomes it. */
  public id: PeerId | null = null;
  /** The network joined or created, null outside one. */
  public network: NetworkInfo | null = null;
  /** Resolves with this peer's id once the server welcomes it. */
  public readonly ready: Promise<PeerId>;
  /** The signalling socket. */
  public socket: SocketLink;
  // an id the server assigned on a reconnect while in a network, taken on leave
  private reassigned: PeerId | null = null;
  // the socket was closed on purpose (keepSocket), the client is still in its network
  private dropped = false;
  // the network's id on the server after the host registered it again
  private serverNetwork: string | null = null;
  // the network's password, kept so a new host can register it again
  private password: string | undefined;
  /** The router, created on the first welcome. */
  public router: Network | null = null;
  /** Media plan, captures, remote streams and plan channels. */
  public readonly media: Media;

  private pending = new Map<PeerId, PeerLink>();
  private _status: ClientStatus = "connecting";
  private connectedOnce = false;
  private ownProfile: Profile;
  private profileMap = new Map<PeerId, Profile>();
  private wakingTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeTimer: ReturnType<typeof setInterval> | null = null;
  private requests: Request[] = [];
  private joining: string | null = null;
  private closed = false;
  private readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    super();
    this.options = options;
    this.media = new Media({
      view: () => this.router?.view ?? null,
      topology: () => this.router?.topology ?? null,
    });
    this.media.addEventListener("error", this.handleForward);
    this.media.addEventListener("debug", this.handleForward);

    this.ownProfile = options.profile ?? {};
    this.socket = this.openSocket();

    this.wakingTimer = setTimeout(() => {
      this.wakingTimer = null;
      if (this._status === "connecting") this.setStatus("waking");
    }, WAKING_AFTER);
    this.startWake();

    this.ready = new Promise<PeerId>((resolve, reject) => {
      this.socket.addEventListener("welcome", (event: Event) => resolve((event as CustomEvent<PeerId>).detail), { once: true });
      this.socket.addEventListener("close", () => reject(new Error(this.closed ? "client closed" : "could not connect to the server")), { once: true });
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

    const updated: NetworkInfo = await this.request(
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
    if (this.network) throw new Error("already in a network, leave first");

    this.joining = network;
    try
    {
      const welcome: PayloadMap[NetworkType.Welcome] = await this.request(
        SignalType.Join,
        { network, ...(password ? { password } : {}), profile: this.ownProfile },
        message => {
          if (message.meta.network !== network) return undefined;
          if (message.meta.type === NetworkType.Reject)
          {
            throw new Error(`rejected: ${(message.payload as PayloadMap[NetworkType.Reject]).reason}`);
          }
          return message.meta.type === NetworkType.Welcome ? message.payload : undefined;
        },
      );

      this.password = password;
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

    this.signal(SignalType.Leave, { network: this.serverNetwork ?? network.id });
    this.serverNetwork = null;
    this.password = undefined;
    this.sendReserved(BROADCAST, NetworkType.Leave, { peer: this.id! });

    this.network = null;
    router.info = undefined;
    this.media.setPlan(undefined);
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

  /** Leaves, closes the socket and rejects pending requests. */
  close() {
    if (this.closed) return;
    this.closed = true;

    this.leave();
    this.stopWake();
    if (this.wakingTimer !== null) clearTimeout(this.wakingTimer);
    this.wakingTimer = null;
    this.media.close();
    this.media.removeEventListener("error", this.handleForward);
    this.media.removeEventListener("debug", this.handleForward);
    for (const request of [...this.requests]) this.settle(request, undefined, new Error("client closed"));

    this.socket.removeEventListener("welcome", this.handleWelcome);
    this.socket.removeEventListener("disconnect", this.handleDisconnect);
    this.socket.removeEventListener("open", this.handleSocketOpen);
    this.socket.close();
    this.socket.removeEventListener("close", this.handleSocketClose);
    this.socket.removeEventListener("error", this.handleForward);
    this.socket.removeEventListener("debug", this.handleForward);

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

    const link = new PeerLink(this.id!, peer, router, { rtc: this.options.rtc });
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

      router.addLink(link);
      this.dropSocket();
    };
    const handleClose = () => {
      cleanup();
      if (this.pending.get(peer) !== link) return;
      this.pending.delete(peer);
      this.debug("link", `link to ${peer} closed before it opened (${link.connection.connectionState})`, { peer });
    };

    link.addEventListener("open", handleOpen);
    link.addEventListener("close", handleClose);
    link.addEventListener("error", this.handleForward);
    link.addEventListener("debug", this.handleForward);

    this.debug("link", `${offer ? "answering" : "offering"} ${peer}`, { peer });
    link.connect(offer);
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
    for (const peer of router.desired())
    {
      if (!this.pending.has(peer) && this.initiates(peer)) this.link(peer);
    }
  }

  /**
   * Sends the member list to every other member, one by one: a peer this node has no route to yet
   * (a new star hub, say) still gets it through the server.
   */
  private broadcastMembers(except?: PeerId) {
    const router = this.router;
    if (!router || !this.network) return;

    const members = [...router.view.members];
    for (const member of members)
    {
      if (member === this.id || member === except) continue;
      this.sendReserved(member, NetworkType.Members, { members, host: router.view.host, profiles: this.profiles });
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

  // the new host without a socket: open one; its welcome registers the network again
  private recreate() {
    this.debug("socket", "host without a socket, opening one to register the network again", null);
    this.dropped = false;
    this.socket = this.openSocket();
  }

  // registers the network under a new server id; joins for it are answered with the network's own id
  private async reregister() {
    const network = this.network;
    if (!network) return;
    try
    {
      const registered: NetworkInfo = await this.request(
        SignalType.Register,
        { name: network.name, topology: network.topology, private: network.private, ...(this.password ? { password: this.password } : {}), ...(network.meta ? { meta: network.meta } : {}), ...(network.media ? { media: network.media } : {}) },
        message => message.meta.type === SignalType.Registered ? (message.payload as PayloadMap[SignalType.Registered]).network : undefined,
      );
      this.serverNetwork = registered.id;
    }
    catch (error)
    {
      this.error("host", "could not register the network again", error);
    }
  }

  private dropSocket() {
    const keep = this.options.keepSocket ?? "host";
    if (keep === true || !this.network || this.pending.size > 0) return;
    if (keep === "host" && this.router?.view.host === this.id) return;
    this.debug("socket", `keepSocket is ${keep}, closing the signalling socket`, null);
    this.dropped = true;
    this.socket.close();
  }

  // sending helpers
  private sendReserved<T extends keyof PayloadMap>(receiver: PeerId, type: T, payload: PayloadMap[T], preferServer = false, network = this.network?.id) {
    return this.router?.send(Message.Create({ type, sender: this.id!, receiver, network }, payload), { preferServer }) ?? false;
  }

  private signal<T extends keyof PayloadMap>(type: T, payload: PayloadMap[T]) {
    const message = Message.Create({ type, sender: this.router?.socketId ?? this.id!, receiver: SERVER }, payload);
    this.router?.send(message);
    return message;
  }

  private request<T>(type: SignalType, payload: object, match: (message: Message) => unknown) {
    return new Promise<T>((resolve, reject) => {
      const message = this.signal(type as keyof PayloadMap, payload as any);
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

    const existing = router.view.members.length > 1;
    const { profile } = message.payload as PayloadMap[NetworkType.Join];
    this.profileMap.set(newcomer, profile ?? {});
    router.setMembers([...router.view.members, newcomer]);
    const view = router.view;
    const members = [...view.members];
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
    router.setMembers(router.view.members, this.id!);
    this.profileMap.set(this.id!, this.ownProfile);
    if (JSON.stringify(network.media ?? {}) !== JSON.stringify(this.media.plan)) this.media.setPlan(network.media);
    this.emit("host", this.id);
    this.broadcastMembers();
    this.reconcile();
  }

  /** Drops a member that left or lost its link, then repairs the topology. */
  private forget(peer: PeerId) {
    const router = this.router;
    if (!router || !this.network || !router.view.members.includes(peer)) return;

    const rest = router.view.members.filter(member => member !== peer);
    // the host left: everyone picks the same successor, the lowest id
    const lostHost = peer === router.view.host;
    const host = lostHost ? [...rest].sort()[0] : router.view.host;
    router.setMembers(rest, host);
    this.profileMap.delete(peer);
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
        else this.reregister();
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
      this.router.addLink(this.socket);
      if (id === this.router.socketId) return;
      if (this.network)
      {
        // the peer id stays; the server knows us by the new socket id from now on
        this.reassigned = id;
        this.router.socketId = id;
        if (this.router.view.host === this.id) this.reregister();
        return;
      }
      this.adopt(id);
      return;
    }

    this.connectedOnce = true;
    this.id = id;
    this.router = new Network({ me: id, topology: this.options.topology });
    this.attachRouter(this.router);
    this.router.addLink(this.socket);
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
        case SignalType.Networks:
        case NetworkType.Welcome:
        case NetworkType.Reject:
          return; // replies to requests no longer pending
        case SignalType.Host: return this.handleHost(message);
        case SignalType.Unreachable: return void this.emit("unreachable", message.payload);
        case SignalType.Error: return void this.error("server", (message.payload as PayloadMap[SignalType.Error]).message, message.payload);
        case NetworkType.Join: return this.handleJoin(message);
        case NetworkType.Members: return this.handleMembers(message);
        case NetworkType.Leave: return this.handleLeave(message);
        case NetworkType.Media: return this.handleMedia(message);
        case NetworkType.Profile: return this.handleProfile(message);
        case HandshakeType.Offer:
          if ((this.network || this.joining) && !this.pending.has(meta.sender))
          {
            this.link(meta.sender, message.payload as Offer);
          }
          return;
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

    this.emit("peer", id);

    // a host's members broadcast can miss peers it had no route to yet (e.g. a new star hub)
    const router = this.router;
    if (router && this.network && router.view.host === this.id)
    {
      this.sendReserved(id, NetworkType.Members, { members: [...router.view.members], host: this.id });
    }
  }

  private handleUnlink = (event: Event) => {
    const id = (event as CustomEvent<PeerId>).detail;
    if (id === SERVER) return;

    this.emit("peer-left", id);
    this.forget(id);
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
