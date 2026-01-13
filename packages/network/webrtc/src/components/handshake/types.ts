import { MessageType } from "../message";

// internal to handshake system 
export type Message =
  | AnswerMessage
  | OfferMessage
  | CandidateMessage;

type AnswerMessage = {
  type: "answer";
  description: RTCSessionDescriptionInit;
}
type OfferMessage = {
  type: "offer";
  description: RTCSessionDescriptionInit;
}
type CandidateMessage = {
  type: "candidate";
  candidate: RTCIceCandidate;
}

// external like in a socket or relay-peer 
export type HandshakeMessage = MessageType<"handshake", Message>;