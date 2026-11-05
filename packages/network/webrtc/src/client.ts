import type { NetworkInfo, PeerId } from "@papit/peer-message";

import { Emitter } from "./emitter";
import { SocketLink } from "./components/socket";
import { SocketBootstrap } from "./bootstrap/socket";
import { PeerConnector } from "./connector";
import { Network, type NetworkOptions } from "./network";
import type { Bootstrap, JoinRequest, NetworkDraft } from "./types";

/** How long an unneeded socket stays open, so what is still in flight arrives. */
export const SOCKET_GRACE = 1_000;

export type ClientOptions = {
  /** The signal server. */
  url: string | URL;
  protocols?: string | string[];
  /** Passed to every `RTCPeerConnection`, e.g. `iceServers`. */
  rtc?: RTCConfiguration;
  /** ms before a handshake fails. */
  handshakeTimeout?: number;
  /** ms without a server connection before the socket gives up. */
  connectTimeout?: number;
};

/** Per network: a bootstrap of your own (e.g. `ParentBootstrap`) and the admission hooks. */
export type NetworkSetup = { bootstrap?: Bootstrap } & Pick<NetworkOptions, "accept" | "acceptMerge" | "topology">;

/**
 * One identity and one signalling socket for any number of networks. The socket opens when a
 * network needs it (create, join, becoming an anchor) and closes once none does.
 * The peer id is the first socket id the server assigned; it stays across reconnects.
 *
 * @fires network - `CustomEvent<Network>`, a network was created or joined
 * @fires error - `CustomEvent<EmitterEvent>`
 * @fires debug - `CustomEvent<EmitterEvent>`
 */
export class Client extends Emitter {
  /** Null until the first socket is welcomed. */
  public id: PeerId | null = null;
  public readonly networks = new Set<Network>();

  private socket: SocketLink | null = null;
  private opening: Promise<SocketLink> | null = null;
  private readonly bootstraps = new Map<Network, SocketBootstrap>();
  private busy = 0;
  private drop: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(private readonly options: ClientOptions) {
    super();
  }

  /** True while the signalling socket is open. */
  get online() {
    return !!this.socket?.open;
  }

  /** Creates a network. Over the signal server, unless `setup.bootstrap` carries it. */
  async create(draft: NetworkDraft, setup: NetworkSetup = {}) {
    return this.run(setup, network => network.create(draft));
  }

  /** Joins a network by id or info. Over the signal server, unless `setup.bootstrap` carries it. */
  async join(network: string | NetworkInfo, request: JoinRequest = {}, setup: NetworkSetup = {}) {
    return this.run(setup, created => created.join(network, request));
  }

  /** Leaves every network and closes the socket. */
  close() {
    if (this.closed) return;
    this.closed = true;

    for (const network of [...this.networks]) network.leave();
    this.clearDrop();
    this.socket?.close();
    this.socket = null;
  }

  // networks
  private async run(setup: NetworkSetup, start: (network: Network) => Promise<unknown>) {
    if (this.closed) throw new Error("the client is closed");

    this.busy++;
    this.clearDrop();
    let network: Network | null = null;
    try
    {
      let bootstrap = setup.bootstrap;
      if (!bootstrap)
      {
        const socket = await this.open();
        bootstrap = new SocketBootstrap(socket, this.id!);
      }

      network = new Network({
        me: bootstrap.me,
        bootstrap,
        connector: new PeerConnector({ rtc: this.options.rtc, timeout: this.options.handshakeTimeout }),
        accept: setup.accept,
        acceptMerge: setup.acceptMerge,
        topology: setup.topology,
      });
      this.track(network, setup.bootstrap ? null : bootstrap as SocketBootstrap);

      await start(network);
      this.emit("network", network);
      return network;
    }
    catch (error)
    {
      network?.close();
      throw error;
    }
    finally
    {
      this.busy--;
      this.settle();
    }
  }

  private track(network: Network, bootstrap: SocketBootstrap | null) {
    this.networks.add(network);
    if (bootstrap) this.bootstraps.set(network, bootstrap);

    const forward = (event: Event) => this.emit(event.type, (event as CustomEvent).detail);
    network.addEventListener("error", forward);
    network.addEventListener("debug", forward);
    network.addEventListener("anchored", () => this.settle());
    network.addEventListener("anchor-request", () => this.handleAnchorRequest(network));
    network.addEventListener("close", () => {
      this.networks.delete(network);
      this.bootstraps.get(network)?.close();
      this.bootstraps.delete(network);
      this.settle();
    }, { once: true });
  }

  // the socket
  private open(): Promise<SocketLink> {
    if (this.socket?.me) return Promise.resolve(this.socket);
    if (this.opening) return this.opening;

    this.opening = new Promise<SocketLink>((resolve, reject) => {
      const socket = new SocketLink(this.options.url, { protocols: this.options.protocols, timeout: this.options.connectTimeout });
      const handleFirstClose = () => {
        this.opening = null;
        if (this.socket === socket) this.socket = null;
        reject(new Error("could not connect to the signal server"));
      };

      socket.addEventListener("welcome", () => {
        socket.removeEventListener("close", handleFirstClose);
        socket.addEventListener("close", () => this.handleSocketClose(socket), { once: true });
        this.opening = null;
        this.id ??= socket.me;
        for (const bootstrap of this.bootstraps.values()) bootstrap.use(socket);
        resolve(socket);
      }, { once: true });
      socket.addEventListener("welcome", this.handleWelcome);
      socket.addEventListener("close", handleFirstClose, { once: true });
      socket.addEventListener("error", this.handleForward);
      socket.addEventListener("debug", this.handleForward);
      this.socket = socket;
    });
    return this.opening;
  }

  /** Closes the socket once nothing needs it: no create or join under way, no anchor. */
  private settle() {
    if (this.closed || !this.socket || this.busy > 0) return;
    if ([...this.bootstraps.keys()].some(network => network.anchored)) return;

    this.clearDrop();
    this.drop = setTimeout(() => {
      this.drop = null;
      if (this.busy > 0 || [...this.bootstraps.keys()].some(network => network.anchored)) return;

      this.debug("socket", "no network needs the socket, closing it", null);
      for (const bootstrap of this.bootstraps.values()) bootstrap.use(null);
      const socket = this.socket;
      this.socket = null;
      socket?.close();
    }, SOCKET_GRACE);
  }

  private clearDrop() {
    if (this.drop !== null) clearTimeout(this.drop);
    this.drop = null;
  }

  // event handlers
  private async handleAnchorRequest(network: Network) {
    const bootstrap = this.bootstraps.get(network);
    if (!bootstrap || this.closed) return;

    this.busy++;
    this.clearDrop();
    try
    {
      bootstrap.use(await this.open());
      await network.anchor();
    }
    catch (error)
    {
      this.debug("anchor", "couldn't become an anchor", { error });
    }
    finally
    {
      this.busy--;
      this.settle();
    }
  }

  // a reconnect brings a new socket id: anchors re-anchor, so the server aliases the peer id to it
  private handleWelcome = (event: Event) => {
    const socket = event.target as SocketLink;
    if (socket !== this.socket || socket.me === this.id) return;

    this.debug("socket", `the server knows this peer as ${socket.me} now, re-anchoring as ${this.id}`, { socket: socket.me, id: this.id });
    for (const network of this.bootstraps.keys())
    {
      if (network.anchored) network.anchor().catch(error => this.debug("anchor", "re-anchoring failed", { error }));
    }
  }

  private handleSocketClose(socket: SocketLink) {
    if (this.socket !== socket) return;
    this.socket = null;
    for (const bootstrap of this.bootstraps.values()) bootstrap.use(null);
  }

  private handleForward = (event: Event) => {
    this.emit(event.type, (event as CustomEvent).detail);
  }
}
