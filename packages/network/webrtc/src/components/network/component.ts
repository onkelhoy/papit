import { BROADCAST, Message, NetworkInfo, PeerId, read, relay, RelayAction, Seen, SERVER } from "@papit/peer-message";

import { Emitter } from "../../emitter";
import type { Link } from "../link";
import { mesh, topologies, Topology, View } from "../topology";
import type { NetworkOptions } from "./types";

type Attached = {
  link: Link;
  handleMessage: (event: Event) => void;
  handleClose: () => void;
};

/**
 * Transport-agnostic router for one node. Holds the node's links (plus an optional link to the
 * signalling server, the one with id `SERVER`), delivers what is addressed to it and forwards the
 * rest along its `Topology`. Never throws from a link callback; problems surface as events.
 *
 * @fires message - `CustomEvent<Message>`, a message delivered to this node (app payloads stay bytes until `parse()`)
 * @fires drop - `CustomEvent<Message>`, a received message dropped by relay rules or the topology filter
 * @fires unreachable - `CustomEvent<Message>`, a message with no route
 * @fires link - `CustomEvent<PeerId>`, a link was added
 * @fires unlink - `CustomEvent<PeerId>`, a link was removed or closed
 * @fires error - `CustomEvent<EmitterEvent>`, e.g. malformed bytes from a link
 */
export class Network extends Emitter {
  public readonly me: PeerId;
  public info?: NetworkInfo;
  public topology: Topology;

  private host: PeerId;
  private members = new Set<PeerId>();
  private links = new Map<PeerId, Attached>();
  private server: Attached | null = null;
  private seen = new Seen();
  private cached: View | null = null;

  constructor(options: NetworkOptions) {
    super();

    this.me = options.me;
    this.info = options.info;
    this.host = options.info?.host ?? options.me;
    this.members.add(options.me);

    const topology = options.topology ?? options.info?.topology;
    this.topology = (typeof topology === "string" ? topologies[topology] : topology) ?? mesh;
  }

  /** What the topology sees: sorted members (with `me`) and the ids of open peer links. */
  get view(): View {
    this.cached ??= {
      me: this.me,
      host: this.host,
      members: [...this.members].sort(),
      links: [...this.links.keys()].filter(id => this.links.get(id)!.link.open).sort(),
    };
    return this.cached;
  }

  /** Attaches a link; one with id `SERVER` becomes the server link. Replaces (and closes) an existing link with the same id. */
  addLink(link: Link) {
    if (link.id === this.me) return;
    const current = link.id === SERVER ? this.server : this.links.get(link.id);
    if (current?.link === link) return;
    this.removeLink(link.id);

    const attached: Attached = {
      link,
      handleMessage: (event: Event) => this.handleLinkMessage(link, event),
      handleClose: () => this.removeLink(link.id, link),
    };
    link.addEventListener("message", attached.handleMessage);
    link.addEventListener("close", attached.handleClose);
    link.addEventListener("open", this.invalidate);

    if (link.id === SERVER) this.server = attached;
    else this.links.set(link.id, attached);

    this.invalidate();
    this.emit("link", link.id);
  }

  /** Detaches the link to `id`, removes its listeners and closes it. */
  removeLink(id: PeerId, only?: Link) {
    const attached = id === SERVER ? this.server : this.links.get(id);
    if (!attached || (only && attached.link !== only)) return;

    attached.link.removeEventListener("message", attached.handleMessage);
    attached.link.removeEventListener("close", attached.handleClose);
    attached.link.removeEventListener("open", this.invalidate);

    if (id === SERVER) this.server = null;
    else this.links.delete(id);

    this.invalidate();
    attached.link.close();
    this.emit("unlink", id);
  }

  /** Replaces the member list (`me` is always kept) and, optionally, the host. */
  setMembers(members: Iterable<PeerId>, host?: PeerId) {
    this.members = new Set(members);
    this.members.add(this.me);
    if (host) this.host = host;
    this.invalidate();
  }

  /** The members the topology wants `me` linked to that aren't linked yet. */
  desired() {
    const view = this.view;
    return this.topology.neighbors(view, this.me).filter(id => !this.links.has(id));
  }

  /**
   * Sends an outgoing message. Fills in an empty `sender` (and its first hop) with `me` and a missing
   * `network` with `info.id`. Tries, in order: a direct link to the receiver, `topology.route`, the
   * server link (own unicast messages only, the server forwards nothing else). False and `"unreachable"` otherwise.
   * `preferServer` tries the server link before the topology: for signalling (handshakes, welcomes) to a peer
   * the topology can't reach yet.
   */
  send(message: Message, options?: { preferServer?: boolean }) {
    const meta = message.meta;
    if (!meta.sender)
    {
      meta.sender = this.me;
      if (meta.hops.length === 0) meta.hops.push(this.me);
    }
    if (meta.network === undefined && this.info) meta.network = this.info.id;

    if (meta.receiver === this.me)
    {
      this.emit("message", message);
      return true;
    }

    if (meta.receiver === BROADCAST) this.seen.check(meta.id);
    return this.dispatch(message, options?.preferServer);
  }

  /** Closes and removes every link, the server link included, and forgets the members. */
  close() {
    for (const id of [...this.links.keys()]) this.removeLink(id);
    if (this.server) this.removeLink(SERVER);
    this.setMembers([]);
  }

  // routing
  private dispatch(message: Message, preferServer = false) {
    const meta = message.meta;
    const bytes = message.toBinary(true);

    if (meta.receiver === BROADCAST)
    {
      return this.sendTo(this.topology.route(this.view, meta), bytes) > 0;
    }

    const direct = meta.receiver === SERVER ? this.server : this.links.get(meta.receiver);
    if (direct?.link.send(bytes)) return true;

    const own = meta.sender === this.me;
    if (preferServer && own && this.server?.link.send(bytes)) return true;

    if (this.sendTo(this.topology.route(this.view, meta), bytes) > 0) return true;

    if (own && !preferServer && this.server?.link.send(bytes)) return true;

    this.emit("unreachable", message);
    return false;
  }

  private sendTo(ids: PeerId[], bytes: Uint8Array) {
    let sent = 0;
    for (const id of ids)
    {
      if (this.links.get(id)?.link.send(bytes)) sent++;
    }
    return sent;
  }

  private decide(message: Message): RelayAction {
    const meta = message.meta;
    const override = this.topology.filter?.(this.view, meta);
    if (override === "drop" || override === "deliver") return override;

    const action = relay(meta, this.me);
    if (action === "drop" || !override) return action;

    // forward/both overrides still respect relay's loop and ttl checks
    return override;
  }

  // event handlers
  private handleLinkMessage(link: Link, event: Event) {
    try
    {
      const bytes = (event as CustomEvent<Uint8Array>).detail;
      const message = read(bytes);
      if (!message)
      {
        this.error("read", "malformed message", { from: link.id });
        return;
      }

      if (message.meta.receiver === BROADCAST && !this.seen.check(message.meta.id))
      {
        this.debug("duplicate", "broadcast already seen", message);
        return;
      }

      const action = this.decide(message);
      if (action === "drop")
      {
        this.emit("drop", message);
        return;
      }

      if (action === "deliver" || action === "both") this.emit("message", message);
      if (action === "forward" || action === "both") this.dispatch(message);
    }
    catch (error)
    {
      this.error("link", "failed to handle a link message", { from: link.id, error });
    }
  }

  private invalidate = () => {
    this.cached = null;
  }
}
