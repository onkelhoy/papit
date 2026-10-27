import type { PeerId } from "@papit/peer-message";
import type { Link } from "./types";

/**
 * In-memory `Link`, for tests and same-page networks. Delivery is async (one microtask per message),
 * in order, and copies the bytes. Create ends with `MemoryLink.pair`.
 */
export class MemoryLink extends EventTarget implements Link {
  private other: MemoryLink | null = null;
  private _open = true;

  private constructor(public readonly id: PeerId) {
    super();
  }

  /**
   * Creates both ends of a link between `aId` and `bId`. The first end belongs to `aId`
   * (so its `id` is `bId`), the second to `bId`. Both start open; `"open"` fires in a microtask.
   * Closing either end closes both.
   */
  static pair(aId: PeerId, bId: PeerId): [Link, Link] {
    const a = new MemoryLink(bId);
    const b = new MemoryLink(aId);
    a.other = b;
    b.other = a;

    queueMicrotask(() => {
      if (a._open) a.dispatchEvent(new Event("open"));
      if (b._open) b.dispatchEvent(new Event("open"));
    });

    return [a, b];
  }

  get open() {
    return this._open;
  }

  send(bytes: Uint8Array) {
    const other = this.other;
    if (!this._open || !other) return false;

    const copy = bytes.slice();
    queueMicrotask(() => {
      if (!other._open) return;
      other.dispatchEvent(new CustomEvent<Uint8Array>("message", { detail: copy }));
    });

    return true;
  }

  close() {
    if (!this._open) return;

    const other = this.other;
    this._open = false;
    this.other = null;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));

    other?.close();
  }
}
