import type { Message as PeerMessage } from "@papit/peer-message";

// internal to handshake system
export type Message =
  | AnswerMessage
  | OfferMessage
  | CandidateMessage;

type AnswerMessage = {
  type: "answer";
  description: RTCSessionDescriptionInit;
  session: string;
}
type OfferMessage = {
  type: "offer";
  description: RTCSessionDescriptionInit;
  streams?: Record<string, string>;
  session: string;
}
type CandidateMessage = {
  type: "candidate";
  candidate: RTCIceCandidateInit;
}

/** How the media manager plugs into negotiation. */
export type HandshakeHooks = {
  /** mid → stream name for the transceivers this side named; sent with every offer. */
  streams?(): Record<string, string>;
  /** A remote offer is about to be applied, with its stream map. */
  offer?(streams: Record<string, string>): void;
  /** The remote offer is applied; adjust transceivers before the answer is created. */
  answer?(): void;
}

/** What a handshake signals through: `send` passes a message on, `"message"` events bring the replies. The old `Network` is one. */
export interface Signaller extends EventTarget {
  send(message: PeerMessage, options?: { preferServer?: boolean }): unknown;
}
