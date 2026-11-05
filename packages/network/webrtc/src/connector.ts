import { HandshakeType, Message, uuid } from "@papit/peer-message";
import type { PayloadMap, PeerId } from "@papit/peer-message";

import { HANDSHAKE_TIMEOUT, type Offer, type Signaller } from "./components/handshake";
import type { Link } from "./components/link";
import { PeerLink, type PeerOptions } from "./components/peer";
import type { Network } from "./network";
import type { Connector } from "./types";

/** What a `MemoryConnector` needs from its world: the far end's link, attached there, or null when it can't be reached. */
export interface MemoryWorld {
  pair(network: Network, peer: PeerId): Link | null;
}

/**
 * Opens `MemoryLink`s for tests. Offer and answer travel as real `handshake.*` messages over
 * `network.signal`, so the signalling paths (back paths, `via`, the bootstrap) are exercised.
 * Glare per rule 3: the lower id's outbound attempt wins.
 */
export class MemoryConnector implements Connector {
  private readonly pending = new Map<PeerId, { session: string; network: Network; timer: unknown }>();

  constructor(private readonly world: MemoryWorld, private readonly timeout = HANDSHAKE_TIMEOUT) { }

  connect(network: Network, peer: PeerId, via?: PeerId[]) {
    this.cancel(peer);

    const session = uuid();
    const timer = network.clock.setTimeout(() => {
      if (this.pending.get(peer)?.session !== session) return;
      this.pending.delete(peer);
      network.fail(peer);
    }, this.timeout);
    this.pending.set(peer, { session, network, timer });

    const offer = Message.Create({ type: HandshakeType.Offer, sender: network.me, receiver: peer }, { description: { type: "offer" }, session });
    network.signal(peer, offer, via);
  }

  handle(network: Network, message: Message) {
    const peer = message.meta.sender;

    if (message.meta.type === HandshakeType.Offer)
    {
      const mine = this.pending.get(peer);
      if (mine && network.me < peer) return;
      // their attempt wins; the link it brings satisfies my want too
      this.cancel(peer);

      const { session } = message.parse() as PayloadMap[HandshakeType.Offer];
      network.signal(peer, Message.Create({ type: HandshakeType.Answer, sender: network.me, receiver: peer }, { description: { type: "answer" }, session }));
      return;
    }

    if (message.meta.type === HandshakeType.Answer)
    {
      const mine = this.pending.get(peer);
      const { session } = message.parse() as PayloadMap[HandshakeType.Answer];
      if (!mine || mine.session !== session) return;

      this.cancel(peer);
      const link = this.world.pair(network, peer);
      if (link) network.attach(link);
      else network.fail(peer);
    }
  }

  cancel(peer: PeerId) {
    const mine = this.pending.get(peer);
    if (!mine) return;
    mine.network.clock.clearTimeout(mine.timer);
    this.pending.delete(peer);
  }

  close() {
    for (const peer of [...this.pending.keys()]) this.cancel(peer);
  }
}

/**
 * Opens WebRTC links (`PeerLink`), one connection per peer. The handshake signals through the
 * Network's send path. Simultaneous offers meet inside one connection and perfect negotiation
 * settles them, so there is still one link per pair.
 */
export class PeerConnector implements Connector {
  private readonly links = new Map<PeerId, PeerLink>();
  private readonly via = new Map<PeerId, PeerId[]>();
  private signaller: Signaller | null = null;

  constructor(private readonly options: PeerOptions = {}) { }

  connect(network: Network, peer: PeerId, via?: PeerId[]) {
    if (via?.length) this.via.set(peer, via);
    else this.via.delete(peer);
    if (this.links.has(peer)) return;

    const link = this.create(network, peer);
    network.attach(link);
    link.connect();
  }

  handle(network: Network, message: Message) {
    const peer = message.meta.sender;
    const current = this.links.get(peer);

    if (message.meta.type === HandshakeType.Offer)
    {
      const offer = message.parse() as Offer;
      // a new session means the peer's end of the old connection is gone
      const remote = current?.handshake.remoteSession;
      const stale = !!current && !!remote && !!offer.session && offer.session !== remote;
      if (current && !stale) return void this.adapter(network).dispatchEvent(new CustomEvent("message", { detail: message }));

      current?.close();
      const link = this.create(network, peer);
      network.attach(link);
      link.connect(offer);
      return;
    }

    if (current) this.adapter(network).dispatchEvent(new CustomEvent("message", { detail: message }));
  }

  cancel(peer: PeerId) {
    const link = this.links.get(peer);
    if (link && !link.open) link.close();
  }

  /** Closes the attempts still under way; the Network closes the open links itself. */
  close() {
    for (const link of [...this.links.values()]) if (!link.open) link.close();
    this.links.clear();
    this.via.clear();
  }

  private create(network: Network, peer: PeerId) {
    const link = new PeerLink(network.me, peer, this.adapter(network), this.options);
    this.links.set(peer, link);
    // channels and stream slots go on before the first offer
    network.media.attach(link);
    link.addEventListener("close", () => {
      if (this.links.get(peer) === link) this.links.delete(peer);
    }, { once: true });
    return link;
  }

  private adapter(network: Network): Signaller {
    this.signaller ??= Object.assign(new EventTarget(), {
      send: (message: Message) => network.signal(message.meta.receiver, message, this.via.get(message.meta.receiver)),
    });
    return this.signaller;
  }
}
