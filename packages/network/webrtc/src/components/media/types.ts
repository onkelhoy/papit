import type { MediaPlan, PeerId } from "@papit/peer-message";

/** What `Media.start` captures: a ready `MediaStream`, or constraints. `display: true` uses screen capture. */
export type MediaSource = MediaStream | (MediaStreamConstraints & { display?: boolean });

/** The part of a topology node that shapes media: which streams go to `peer`, and where a relayed stream comes from. */
export type MediaTopology = {
  media?(peer: PeerId, plan: MediaPlan): MediaPlan;
  relay?(name: string): PeerId | null;
}

/** What the media manager reads from its owner. */
export type MediaContext = {
  /** Open direct links. */
  links(): PeerId[];
  topology(): MediaTopology | null;
}

/** Data a channel can send, as `RTCDataChannel.send` takes it. */
export type ChannelData = string | Blob | ArrayBuffer | ArrayBufferView<ArrayBuffer>;

export type StreamDetail = { peer: PeerId; name: string; stream: MediaStream };
export type ChannelDetail = { peer: PeerId; label: string };
export type ChannelMessage = { peer: PeerId; data: string | ArrayBuffer };
