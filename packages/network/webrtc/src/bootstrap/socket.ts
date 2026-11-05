import { Message, read, SERVER, SignalType } from "@papit/peer-message";
import type { NetworkInfo, PayloadMap, PeerId } from "@papit/peer-message";

import type { SocketLink } from "../components/socket";
import type { AnchorResult, Bootstrap, Carrier, JoinRequest, NetworkDraft, NetworkUpdate } from "../types";

type Waiting = { type: SignalType; network?: string; resolve: (payload: any) => void; reject: (error: Error) => void };

/**
 * Reaches networks through the signal server. Maps the `Bootstrap` methods to `signal.*` messages
 * over a welcomed `SocketLink`; the server forwards `signal()` bytes by receiver id (or alias).
 * `me` is the peer's identity, by default the socket's id. The socket can be swapped (`use`) or
 * dropped (`use(null)`): without one, `signal` is false and requests reject. After a reconnect the
 * socket id differs from `me`; the server then only reaches `me` through the alias `anchor` sets,
 * and `signal` stays false, since the server only forwards a socket's own id.
 */
export class SocketBootstrap extends EventTarget implements Bootstrap {
  public readonly checksPassword = true;
  private readonly carrier: Carrier;
  private readonly waiting = new Map<string, Waiting>();
  private readonly joins = new Set<string>();
  private closed = false;
  private socket: SocketLink | null = null;
  public readonly me: PeerId;

  /** @throws {Error} without `me` and a welcomed socket */
  constructor(socket: SocketLink | null, me?: PeerId) {
    super();
    const id = me ?? socket?.me;
    if (!id) throw new Error("the socket has no id yet, wait for its welcome");

    this.me = id;
    this.carrier = { send: bytes => !!this.socket?.send(bytes) };
    this.use(socket);
  }

  /** Swaps the socket; null drops it. Pending requests on the old one reject. */
  use(socket: SocketLink | null) {
    if (this.closed || socket === this.socket) return;

    if (this.socket)
    {
      this.socket.removeEventListener("message", this.handleMessage);
      this.socket.removeEventListener("close", this.handleClose);
      this.fail(new Error("the socket was replaced"));
    }
    this.socket = socket;
    socket?.addEventListener("message", this.handleMessage);
    socket?.addEventListener("close", this.handleClose);
  }

  /** The socket id the server knows, null without a socket. */
  private get sender() {
    return this.socket?.me ?? null;
  }

  create(draft: NetworkDraft, keyHash: string): Promise<NetworkInfo> {
    const { beacon, ...register } = draft;
    return this.request(SignalType.Register, { ...register, keyHash }, SignalType.Registered)
      .then(({ network }: PayloadMap[SignalType.Registered]) => beacon === undefined ? network : { ...network, beacon });
  }

  /** Resolves once the join is sent. A refusal, or an entry that can't be reached, arrives later as a `network.reject`. */
  async join(network: string | NetworkInfo, request: JoinRequest) {
    const { password, profile, merge } = request;
    const id = typeof network === "string" ? network : network.id;
    const message = this.message(SignalType.Join, { network: id, ...(password ? { password } : {}), ...(profile ? { profile } : {}), ...(merge ? { merge } : {}) });
    this.joins.add(message.meta.id);
    if (!this.socket?.send(message.toBinary(true))) throw new Error("no socket");
  }

  signal(peer: PeerId, bytes: Uint8Array) {
    return !this.closed && this.sender === this.me && !!this.socket?.send(bytes);
  }

  anchor(info: NetworkInfo, keyHash: string): Promise<AnchorResult> {
    return this.request(SignalType.Anchor, { network: info, keyHash, peer: this.me }, SignalType.Anchored, info.id)
      .then(({ ok, existed, entry }: PayloadMap[SignalType.Anchored]) => entry ? { ok, existed, entry } : { ok, existed });
  }

  update(network: string, changes: NetworkUpdate): Promise<NetworkInfo> {
    return this.request(SignalType.Update, { network, ...changes }, SignalType.Updated)
      .then(({ network }: PayloadMap[SignalType.Updated]) => network);
  }

  unanchor(network: string) {
    if (!this.closed) this.socket?.send(this.message(SignalType.Unanchor, { network }).toBinary(true));
  }

  /** Detaches from the socket. The socket itself belongs to whoever opened it. */
  close() {
    if (this.closed) return;
    this.use(null);
    this.closed = true;
    this.fail(new Error("closed"));
  }

  private message<T extends keyof PayloadMap>(type: T, payload: PayloadMap[T]) {
    return Message.Create({ type, sender: this.sender ?? this.me, receiver: SERVER }, payload);
  }

  private request(type: SignalType, payload: any, answer: SignalType, network?: string) {
    return new Promise<any>((resolve, reject) => {
      if (this.closed) return void reject(new Error("closed"));
      if (!this.socket) return void reject(new Error("no socket"));

      const message = this.message(type as keyof PayloadMap, payload);
      this.waiting.set(message.meta.id, { type: answer, network, resolve, reject });
      if (!this.socket.send(message.toBinary(true)))
      {
        this.waiting.delete(message.meta.id);
        reject(new Error("the socket is closed"));
      }
    });
  }

  private fail(error: Error) {
    for (const waiting of this.waiting.values()) waiting.reject(error);
    this.waiting.clear();
    this.joins.clear();
  }

  // event handlers
  private handleClose = () => {
    this.fail(new Error("the socket closed"));
  }

  private handleMessage = (event: Event) => {
    const message = read((event as CustomEvent<Uint8Array>).detail);
    if (!message) return;

    const { type, sender } = message.meta;
    if (!type.startsWith("signal.") || sender !== SERVER)
    {
      this.dispatchEvent(new CustomEvent("message", { detail: { message, carrier: this.carrier } }));
      return;
    }

    switch (type)
    {
      case SignalType.Anchors:
        this.dispatchEvent(new CustomEvent("anchors", { detail: message.parse() }));
        return;

      case SignalType.Error: {
        const { ref, message: reason } = message.parse() as PayloadMap[SignalType.Error];
        const waiting = ref ? this.waiting.get(ref) : undefined;
        if (waiting)
        {
          this.waiting.delete(ref!);
          waiting.reject(new Error(reason));
        }
        else if (ref && this.joins.delete(ref)) this.refuse(reason);
        return;
      }

      case SignalType.Unreachable: {
        const { ref } = message.parse() as PayloadMap[SignalType.Unreachable];
        if (this.joins.delete(ref)) this.refuse("no entry can be reached");
        return;
      }

      default:
        for (const [ref, waiting] of this.waiting)
        {
          if (waiting.type !== type) continue;

          const payload = message.parse() as any;
          if (waiting.network && payload.network !== waiting.network) continue;
          this.waiting.delete(ref);
          waiting.resolve(payload);
          return;
        }
    }
  }

  // a failed join reaches the Network as the reject an entry would have sent
  private refuse(reason: string) {
    const reject = Message.Create({ type: "network.reject", sender: SERVER, receiver: this.me }, { reason });
    this.dispatchEvent(new CustomEvent("message", { detail: { message: reject, carrier: this.carrier } }));
  }
}
