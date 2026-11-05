import { Registry, read, SignalType, uuid } from "@papit/peer-message";
import type { Message, NetworkInfo, PayloadMap, PeerId, RegistryOptions, Reply } from "@papit/peer-message";

import type { AnchorResult, Bootstrap, Carrier, JoinRequest, NetworkDraft, NetworkUpdate } from "../types";

/**
 * An in-memory signal server built on `Registry`, for tests. Forwards a socket's own messages by
 * receiver id and counts every message it carries in `carried`.
 */
export class MemoryServer {
  public readonly registry: Registry;
  /** Messages delivered to a socket: forwarded ones and the registry's. */
  public carried = 0;
  private readonly sockets = new Map<PeerId, Set<MemoryBootstrap>>();

  constructor(options: RegistryOptions = {}) {
    this.registry = new Registry({ reachable: peer => this.sockets.has(peer), ...options });
  }

  /** A socket for `me`. */
  connect(me: PeerId) {
    const bootstrap = new MemoryBootstrap(this, me);
    if (!this.sockets.has(me)) this.sockets.set(me, new Set());
    this.sockets.get(me)!.add(bootstrap);
    return bootstrap;
  }

  /** Internal: a socket closed. The last one of an id drops it from the registry. */
  remove(bootstrap: MemoryBootstrap) {
    const set = this.sockets.get(bootstrap.me);
    if (!set?.delete(bootstrap) || set.size) return;
    this.sockets.delete(bootstrap.me);
    this.deliver(this.registry.drop(bootstrap.me));
  }

  /** Internal: forwards bytes `from` sent to their receiver. Only a socket's own messages pass. */
  forward(from: PeerId, bytes: Uint8Array) {
    const message = read(bytes);
    if (!message || message.meta.sender !== from || !this.sockets.has(from)) return false;

    const targets = this.sockets.get(message.meta.receiver);
    if (!targets) return false;

    this.carried++;
    const copy = bytes.slice();
    queueMicrotask(() => {
      for (const target of targets) target.take(copy);
    });
    return true;
  }

  /** Internal: delivers the registry's replies. */
  deliver(replies: Reply[]) {
    for (const { to, message } of replies)
    {
      const targets = this.sockets.get(to);
      if (!targets) continue;

      this.carried++;
      const bytes = message.toBinary(true);
      queueMicrotask(() => {
        for (const target of targets) target.take(bytes.slice());
      });
    }
  }
}

/** One socket to a `MemoryServer`. The registry checks join passwords. */
export class MemoryBootstrap extends EventTarget implements Bootstrap {
  public readonly checksPassword = true;
  private readonly carrier: Carrier;
  private closed = false;

  constructor(private readonly server: MemoryServer, public readonly me: PeerId) {
    super();
    this.carrier = { send: bytes => !this.closed && this.server.forward(this.me, bytes) };
  }

  async create(draft: NetworkDraft, keyHash: string): Promise<NetworkInfo> {
    const { beacon, ...register } = draft;
    const replies = this.call(this.server.registry.register(this.me, { ...register, keyHash }));
    const registered = this.answer<SignalType.Registered>(replies, SignalType.Registered);
    return beacon === undefined ? registered.network : { ...registered.network, beacon };
  }

  async join(network: string | NetworkInfo, request: JoinRequest) {
    const id = typeof network === "string" ? network : network.id;
    const { password, profile, merge } = request;
    const mine = this.call(this.server.registry.join(this.me, { network: id, ...(password ? { password } : {}), ...(profile ? { profile } : {}), ...(merge ? { merge } : {}) }, uuid()));
    if (mine.some(message => message.meta.type === SignalType.Unreachable)) throw new Error("no entry can be reached");
  }

  signal(peer: PeerId, bytes: Uint8Array) {
    if (this.closed) return false;
    const message = read(bytes);
    return !!message && message.meta.receiver === peer && this.server.forward(this.me, bytes);
  }

  async anchor(info: NetworkInfo, keyHash: string): Promise<AnchorResult> {
    const replies = this.call(this.server.registry.anchor(this.me, { network: info, keyHash, peer: this.me }, uuid()));
    const { ok, existed, entry } = this.answer<SignalType.Anchored>(replies, SignalType.Anchored);
    return entry ? { ok, existed, entry } : { ok, existed };
  }

  async update(network: string, changes: NetworkUpdate): Promise<NetworkInfo> {
    const replies = this.call(this.server.registry.update(this.me, { network, ...changes }, uuid()));
    return this.answer<SignalType.Updated>(replies, SignalType.Updated).network;
  }

  unanchor(network: string) {
    this.call(this.server.registry.unanchor(this.me, { network }));
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.server.remove(this);
  }

  /** Internal: bytes the server delivers to this socket. */
  take(bytes: Uint8Array) {
    if (this.closed) return;
    const message = read(bytes);
    if (!message) return;

    if (message.meta.type === SignalType.Anchors)
    {
      this.dispatchEvent(new CustomEvent("anchors", { detail: message.parse() }));
      return;
    }
    if (message.meta.type.startsWith("signal.")) return;

    this.dispatchEvent(new CustomEvent("message", { detail: { message, carrier: this.carrier } }));
  }

  /** Runs a registry call: the replies for others go out, mine come back. Errors for me throw. */
  private call(replies: Reply[]) {
    if (this.closed) throw new Error("the socket is closed");

    const mine = replies.filter(reply => reply.to === this.me && reply.message.meta.type !== SignalType.Anchors);
    const error = mine.find(reply => reply.message.meta.type === SignalType.Error);
    if (error) throw new Error((error.message.parse() as PayloadMap[SignalType.Error]).message);

    this.server.deliver(replies.filter(reply => !mine.includes(reply)));
    return mine.map(reply => reply.message);
  }

  private answer<T extends keyof PayloadMap>(messages: Message[], type: T) {
    const message = messages.find(message => message.meta.type === type);
    if (!message) throw new Error(`no ${type} from the registry`);
    return message.parse() as PayloadMap[T];
  }
}
