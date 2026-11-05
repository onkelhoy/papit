import { Message, NetworkType } from "@papit/peer-message";
import type { NetworkInfo, PeerId } from "@papit/peer-message";

import type { Network } from "../network";
import type { Bootstrap, Carrier, JoinRequest, NetworkDraft } from "../types";

/** How long one entry gets to answer a join before the next is tried. */
export const ENTRY_TIMEOUT = 5_000;

type Pending = { entries: PeerId[]; index: number; info: NetworkInfo; request: JoinRequest; cancel: () => void };

/**
 * Carries a network over another one: first contact and joins travel as `network.room` messages through
 * the parent's send path. Joins come in through an invite's `entries`. No anchors, so no split healing
 * unless the app adds its own registry. Dispatches `"lost"` when the parent closes.
 */
export class ParentBootstrap extends EventTarget implements Bootstrap {
  public readonly me: PeerId;
  private closed = false;
  private pending: Pending | null = null;
  private readonly release: () => void;

  constructor(private readonly parent: Network, public readonly id: string) {
    super();
    this.me = parent.me;
    this.release = parent.inbox(id, (message, from) => this.take(message, from));
    parent.addEventListener("close", this.handleParentClose);
  }

  async create(draft: NetworkDraft): Promise<NetworkInfo> {
    if (this.closed) throw new Error("the parent is closed");
    const { password, ...rest } = draft;
    return { ...rest, id: this.id, private: draft.private ?? true, size: 1, entries: [this.me] };
  }

  /** Sends `network.join` to the invite's first entry; a reject or silence moves on to the next. */
  async join(network: string | NetworkInfo, request: JoinRequest) {
    if (this.closed) throw new Error("the parent is closed");
    if (typeof network === "string" || !network.entries?.length) throw new Error("a carried network is joined by invite");
    if (network.id !== this.id) throw new Error(`the invite is for ${network.id}, not ${this.id}`);

    this.pending?.cancel();
    const entries = network.entries.filter(entry => entry !== this.me);
    if (!entries.length) throw new Error("no entry but me");
    this.pending = { entries, index: -1, info: network, request, cancel: () => { } };
    this.next(null);
  }

  signal(peer: PeerId, bytes: Uint8Array) {
    return !this.closed && this.parent.carry(this.id, peer, bytes);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.pending?.cancel();
    this.pending = null;
    this.release();
    this.parent.removeEventListener("close", this.handleParentClose);
  }

  /** Tries the next entry; with none left, the last refusal (or a timeout) reaches the network as a reject. */
  private next(reason: string | null) {
    const pending = this.pending;
    if (!pending) return;
    pending.cancel();

    pending.index++;
    const entry = pending.entries[pending.index];
    if (!entry)
    {
      this.pending = null;
      const reject = Message.Create({ type: NetworkType.Reject, sender: this.me, receiver: this.me, network: this.id }, { reason: reason ?? "no entry answered" });
      this.dispatch(reject, { send: () => false });
      return;
    }

    const join = Message.Create({ type: NetworkType.Join, sender: this.me, receiver: entry, network: this.id }, pending.request);
    const sent = this.signal(entry, join.toBinary(true));
    const id = this.parent.clock.setTimeout(() => this.next("join timed out"), sent ? ENTRY_TIMEOUT : 0);
    pending.cancel = () => this.parent.clock.clearTimeout(id);
  }

  private take(message: Message, from: PeerId) {
    if (this.closed) return;

    const pending = this.pending;
    if (pending && message.meta.receiver === this.me)
    {
      if (message.meta.type === NetworkType.Reject) return void this.next((message.parse() as { reason: string }).reason);
      if (message.meta.type === NetworkType.Admit)
      {
        pending.cancel();
        this.pending = null;
      }
    }

    // replies go back the way this came: through the parent, to the peer that sent it
    this.dispatch(message, { send: bytes => this.signal(from, bytes) });
  }

  private dispatch(message: Message, carrier: Carrier) {
    this.dispatchEvent(new CustomEvent("message", { detail: { message, carrier } }));
  }

  private handleParentClose = () => {
    this.close();
    this.dispatchEvent(new Event("lost"));
  }
}
