import { MediaPlan, PeerId } from "@papit/peer-message";

import { Emitter } from "../../emitter";
import type { PeerLink } from "../peer";
import type { ChannelData, MediaContext, MediaSource } from "./types";

type Entry = {
  link: PeerLink;
  /** The lower id creates the transceivers of a link; the other side adopts them by mid. */
  owner: boolean;
  channels: Map<string, RTCDataChannel>;
  slots: Map<string, RTCRtpTransceiver>;
  remoteMids: Map<string, string>;
  remote: Map<string, MediaStream>;
  tracks: Set<MediaStreamTrack>;
  cleanup: (() => void)[];
};

/**
 * Raw data channel by label, across every direct link. No peer-message framing: what one side
 * sends is what the other receives. Messages that arrive before `channel(label)` was called are dropped.
 *
 * @fires message - `CustomEvent<{ peer, data }>`
 */
export class Channel extends EventTarget {
  constructor(public readonly label: string, private readonly media: Media) {
    super();
  }

  /** Peers with this channel open. */
  get peers(): PeerId[] {
    return this.media.peersOn(this.label);
  }

  /** Sends to one directly linked peer. False when that peer's channel isn't open. */
  send(peer: PeerId, data: ChannelData) {
    return this.media.sendOn(this.label, peer, data);
  }

  /** Sends to every directly linked peer with the channel open; returns how many. */
  broadcast(data: ChannelData) {
    let sent = 0;
    for (const peer of this.peers)
    {
      if (this.send(peer, data)) sent++;
    }
    return sent;
  }
}

/**
 * Media manager for a `Client` (`client.media`): the network's media plan, local captures, remote
 * streams and plan channels on every `PeerLink`. Each link gets its channels and empty transceiver
 * slots before its first offer, so nothing is captured or sent until `start()`.
 *
 * @fires stream - `CustomEvent<{ peer, name, stream }>`, a remote stream started arriving
 * @fires stream-ended - `CustomEvent<{ peer, name }>`, a remote stream stopped or its link closed
 * @fires capture - `CustomEvent<{ name, stream }>`, a local capture started
 * @fires capture-ended - `CustomEvent<{ name }>`, a local capture stopped (also when the user ends a screen share)
 * @fires channel-open - `CustomEvent<{ peer, label }>`
 * @fires channel-close - `CustomEvent<{ peer, label }>`
 */
export class Media extends Emitter {
  private _plan: MediaPlan = {};
  private captures = new Map<string, { stream: MediaStream; track: MediaStreamTrack; handleEnded: () => void }>();
  private entries = new Map<PeerId, Entry>();
  private handles = new Map<string, Channel>();

  constructor(private readonly context: MediaContext) {
    super();
  }

  /** The current plan. */
  get plan(): MediaPlan {
    return this._plan;
  }

  /**
   * Replaces the plan and applies it to every link: new channels and stream slots are added
   * (renegotiating as needed), removed channels close, removed streams go inactive and their captures stop.
   */
  setPlan(plan: MediaPlan | undefined) {
    this._plan = structuredClone(plan ?? {});

    for (const name of [...this.captures.keys()])
    {
      if (!this._plan.streams?.[name]) this.stop(name);
    }
    for (const entry of this.entries.values()) this.apply(entry);
  }

  /**
   * Captures a stream from the plan and sends it on every link that carries it.
   * Without a source it asks for the plan's kind with `getUserMedia`, or `getDisplayMedia` when
   * `display` is set or the stream is named `"screen"`.
   *
   * @throws when the name isn't in the plan, or the capture has no track of the plan's kind
   */
  async start(name: string, source?: MediaSource): Promise<MediaStream> {
    const stream = this._plan.streams?.[name];
    if (!stream) throw new Error(`"${name}" is not a stream in the media plan`);

    let media: MediaStream;
    if (source instanceof MediaStream)
    {
      media = source;
    }
    else
    {
      const { display = name === "screen", ...constraints } = source ?? {};
      const given = Object.keys(constraints).length > 0;
      media = display
        ? await navigator.mediaDevices.getDisplayMedia(given ? constraints : { video: stream.kind === "video", audio: stream.kind === "audio" })
        : await navigator.mediaDevices.getUserMedia(given ? constraints : { [stream.kind]: true });
    }

    const track = media.getTracks().find(t => t.kind === stream.kind);
    if (!track)
    {
      media.getTracks().forEach(t => t.stop());
      throw new Error(`the capture for "${name}" has no ${stream.kind} track`);
    }
    if (!this._plan.streams?.[name])
    {
      // the plan changed while we waited for permission
      media.getTracks().forEach(t => t.stop());
      throw new Error(`"${name}" was removed from the media plan`);
    }

    this.stop(name);
    const handleEnded = () => this.stop(name);
    track.addEventListener("ended", handleEnded);
    this.captures.set(name, { stream: media, track, handleEnded });

    for (const entry of this.entries.values()) this.applyStreams(entry);
    this.emit("capture", { name, stream: media });
    return media;
  }

  /** Stops a local capture: its slots send nothing again and its tracks stop. */
  stop(name: string) {
    const capture = this.captures.get(name);
    if (!capture) return;

    this.captures.delete(name);
    capture.track.removeEventListener("ended", capture.handleEnded);
    capture.stream.getTracks().forEach(t => t.stop());

    for (const entry of this.entries.values()) this.applyStreams(entry);
    this.emit("capture-ended", { name });
  }

  /** Remote streams from `peer` by name, or the local captures without a peer. */
  streams(peer?: PeerId): Map<string, MediaStream> {
    if (peer === undefined) return new Map([...this.captures].map(([name, c]) => [name, c.stream]));
    return new Map(this.entries.get(peer)?.remote ?? []);
  }

  /** The handle for a plan channel. Labels starting with `_` are reserved. */
  channel(label: string) {
    if (label.startsWith("_")) throw new RangeError(`channel labels starting with "_" are reserved: "${label}"`);

    let handle = this.handles.get(label);
    if (!handle)
    {
      handle = new Channel(label, this);
      this.handles.set(label, handle);
    }
    return handle;
  }

  /**
   * Adds the plan's channels and stream slots to a new link and hooks into its handshake.
   * Call before the link's first offer.
   */
  attach(link: PeerLink) {
    if (this.entries.has(link.id)) this.detach(this.entries.get(link.id)!);

    const entry: Entry = {
      link,
      owner: link.me < link.id,
      channels: new Map(),
      slots: new Map(),
      remoteMids: new Map(),
      remote: new Map(),
      tracks: new Set(),
      cleanup: [],
    };
    this.entries.set(link.id, entry);

    const handleTrack = (event: RTCTrackEvent) => this.handleTrack(entry, event);
    const handleClose = () => this.detach(entry);
    link.connection.addEventListener("track", handleTrack);
    link.addEventListener("close", handleClose);
    entry.cleanup.push(() => {
      link.connection.removeEventListener("track", handleTrack);
      link.removeEventListener("close", handleClose);
    });

    link.handshake.hooks = {
      streams: () => {
        const map: Record<string, string> = {};
        for (const [name, transceiver] of entry.slots)
        {
          if (transceiver.mid) map[transceiver.mid] = name;
        }
        return map;
      },
      offer: (streams) => {
        for (const [mid, name] of Object.entries(streams)) entry.remoteMids.set(mid, name);
      },
      answer: () => this.adopt(entry),
    };

    this.apply(entry);
  }

  /** Stops every capture and forgets every link. */
  close() {
    for (const name of [...this.captures.keys()]) this.stop(name);
    for (const entry of [...this.entries.values()]) this.detach(entry);
    this.handles.clear();
    this._plan = {};
  }

  // used by Channel
  /** @internal */
  peersOn(label: string) {
    const peers: PeerId[] = [];
    for (const [peer, entry] of this.entries)
    {
      if (entry.channels.get(label)?.readyState === "open") peers.push(peer);
    }
    return peers;
  }

  /** @internal */
  sendOn(label: string, peer: PeerId, data: ChannelData) {
    const channel = this.entries.get(peer)?.channels.get(label);
    if (channel?.readyState !== "open") return false;

    try
    {
      channel.send(data as any);
      return true;
    }
    catch (error)
    {
      this.debug("channel", `send on ${label} to ${peer} failed`, error);
      return false;
    }
  }

  // per link
  private apply(entry: Entry) {
    this.applyChannels(entry);
    this.applyStreams(entry);
  }

  private applyChannels(entry: Entry) {
    const plan = this._plan.channels ?? {};
    const labels = Object.keys(plan).sort();

    for (const [label, channel] of entry.channels)
    {
      if (!(label in plan)) channel.close();
    }

    // ids follow the sorted labels on a new link; a later addition takes the lowest free id
    const used = new Set<number>([0, ...[...entry.channels.values()].map(c => c.id ?? -1)]);
    let next = 1;
    for (const label of labels)
    {
      if (entry.channels.has(label)) continue;
      while (used.has(next)) next++;
      used.add(next);
      this.openChannel(entry, label, next);
    }
  }

  private openChannel(entry: Entry, label: string, id: number) {
    const peer = entry.link.id;
    let channel: RTCDataChannel;
    try
    {
      channel = entry.link.connection.createDataChannel(label, { ...this._plan.channels![label], negotiated: true, id });
    }
    catch (error)
    {
      this.error("channel", `could not open channel ${label} to ${peer}`, error);
      return;
    }
    channel.binaryType = "arraybuffer";
    entry.channels.set(label, channel);

    const handleOpen = () => this.emit("channel-open", { peer, label });
    const handleMessage = (event: MessageEvent) => {
      this.handles.get(label)?.dispatchEvent(new CustomEvent("message", { detail: { peer, data: event.data } }));
    };
    const handleClose = () => {
      remove();
      if (entry.channels.get(label) === channel) entry.channels.delete(label);
      this.emit("channel-close", { peer, label });
    };
    const remove = () => {
      channel.removeEventListener("open", handleOpen);
      channel.removeEventListener("message", handleMessage);
      channel.removeEventListener("close", handleClose);
    };

    channel.addEventListener("open", handleOpen);
    channel.addEventListener("message", handleMessage);
    channel.addEventListener("close", handleClose);
    entry.cleanup.push(() => {
      const open = channel.readyState === "open";
      remove();
      if (open) this.emit("channel-close", { peer, label });
    });
  }

  private applyStreams(entry: Entry) {
    const connection = entry.link.connection;
    if (connection.signalingState === "closed") return;

    const streams = this._plan.streams ?? {};
    if (entry.owner)
    {
      for (const name of Object.keys(streams).sort())
      {
        if (entry.slots.has(name)) continue;
        entry.slots.set(name, connection.addTransceiver(streams[name].kind, { direction: this.direction(entry, name) }));
      }
    }

    const allowed = this.allowed(entry.link.id);
    for (const [name, transceiver] of entry.slots)
    {
      if (transceiver.currentDirection === "stopped") continue;

      const direction = this.direction(entry, name, allowed);
      if (transceiver.direction !== direction) transceiver.direction = direction;

      const track = direction === "sendrecv" ? this.captures.get(name)?.track ?? null : null;
      if (transceiver.sender.track !== track)
      {
        transceiver.sender.replaceTrack(track).catch(error => this.debug("track", `replaceTrack for ${name} failed`, error));
      }
    }
  }

  /** The non-owner names the transceivers a remote offer created, by mid. */
  private adopt(entry: Entry) {
    const named = new Set(entry.slots.values());
    for (const transceiver of entry.link.connection.getTransceivers())
    {
      if (!transceiver.mid || named.has(transceiver)) continue;
      const name = entry.remoteMids.get(transceiver.mid);
      if (name && !entry.slots.has(name)) entry.slots.set(name, transceiver);
    }
    this.applyStreams(entry);
  }

  private allowed(peer: PeerId) {
    const names = Object.keys(this._plan.streams ?? {});
    const view = this.context.view();
    const topology = this.context.topology();
    if (!view || !topology?.media) return new Set(names);

    try
    {
      const narrowed = topology.media(view, peer, this._plan).streams ?? {};
      return new Set(names.filter(name => name in narrowed));
    }
    catch (error)
    {
      this.error("topology", `${topology.name}.media failed`, error);
      return new Set(names);
    }
  }

  private direction(entry: Entry, name: string, allowed = this.allowed(entry.link.id)): RTCRtpTransceiverDirection {
    if (!this._plan.streams?.[name]) return "inactive";
    return this.captures.has(name) && allowed.has(name) ? "sendrecv" : "recvonly";
  }

  private nameOf(entry: Entry, transceiver: RTCRtpTransceiver) {
    for (const [name, slot] of entry.slots)
    {
      if (slot === transceiver) return name;
    }
    return transceiver.mid ? entry.remoteMids.get(transceiver.mid) ?? null : null;
  }

  private handleTrack(entry: Entry, event: RTCTrackEvent) {
    const { track, transceiver } = event;
    if (entry.tracks.has(track)) return;
    entry.tracks.add(track);

    const peer = entry.link.id;
    const handleUnmute = () => {
      const name = this.nameOf(entry, transceiver);
      if (!name || entry.remote.has(name)) return;

      const stream = new MediaStream([track]);
      entry.remote.set(name, stream);
      this.emit("stream", { peer, name, stream });
    };
    const handleMute = () => {
      const name = this.nameOf(entry, transceiver);
      if (!name || entry.remote.get(name)?.getTracks()[0] !== track) return;

      entry.remote.delete(name);
      this.emit("stream-ended", { peer, name });
    };

    track.addEventListener("unmute", handleUnmute);
    track.addEventListener("mute", handleMute);
    track.addEventListener("ended", handleMute);
    entry.cleanup.push(() => {
      track.removeEventListener("unmute", handleUnmute);
      track.removeEventListener("mute", handleMute);
      track.removeEventListener("ended", handleMute);
    });

    if (!track.muted) handleUnmute();
  }

  private detach(entry: Entry) {
    if (this.entries.get(entry.link.id) !== entry) return;
    this.entries.delete(entry.link.id);

    entry.cleanup.forEach(fn => fn());
    entry.cleanup = [];
    entry.link.handshake.hooks = {};

    for (const name of entry.remote.keys()) this.emit("stream-ended", { peer: entry.link.id, name });
    entry.remote.clear();
  }
}
