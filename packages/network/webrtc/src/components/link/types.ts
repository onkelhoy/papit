import type { PeerId } from "@papit/peer-message";

/**
 * One direct, bidirectional byte channel to a remote node: a data channel, the signalling socket, or memory.
 * Fires `"open"`, `"close"` and `"message"` (a `CustomEvent` whose `detail` is the received `Uint8Array`).
 */
export interface Link extends EventTarget {
  /** The remote node's id, `SERVER` for the signalling socket. */
  readonly id: PeerId;
  readonly open: boolean;
  /** Sends the bytes as one message. False when the link is not open. */
  send(bytes: Uint8Array): boolean;
  /** Closes the link. Safe to call more than once. */
  close(): void;
}
