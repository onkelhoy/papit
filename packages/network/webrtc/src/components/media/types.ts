import type { PeerId } from "@papit/peer-message";
import type { Topology, View } from "../topology";

/** What `Media.start` captures: a ready `MediaStream`, or constraints. `display: true` uses screen capture. */
export type MediaSource = MediaStream | (MediaStreamConstraints & { display?: boolean });

/** What the media manager reads from its owner. */
export type MediaContext = {
  view(): View | null;
  topology(): Topology | null;
}

/** Data a channel can send, as `RTCDataChannel.send` takes it. */
export type ChannelData = string | Blob | ArrayBuffer | ArrayBufferView<ArrayBuffer>;

export type StreamDetail = { peer: PeerId; name: string; stream: MediaStream };
export type ChannelDetail = { peer: PeerId; label: string };
export type ChannelMessage = { peer: PeerId; data: string | ArrayBuffer };
