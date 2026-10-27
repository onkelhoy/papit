import type { PeerId } from "@papit/peer-message";

import { Emitter } from "../../emitter";
import { Handshake, type Offer } from "../handshake";
import type { Link } from "../link";
import type { Network } from "../network";
import type { PeerOptions } from "./types";

/** Label of the negotiated data channel (id 0) that carries every system and `Client.send` message. */
export const SYSTEM_CHANNEL = "_system";

/**
 * `Link` to one remote peer over WebRTC. Owns its `RTCPeerConnection`, a negotiated data channel
 * (`SYSTEM_CHANNEL`, id 0, so neither side waits for `ondatachannel`) and the `Handshake` that sets it up.
 * Closes itself when the channel closes or the connection fails.
 */
export class PeerLink extends Emitter implements Link {
  public readonly connection: RTCPeerConnection;
  public readonly channel: RTCDataChannel;
  public readonly handshake: Handshake;
  private closed = false;

  constructor(
    public readonly me: PeerId,
    public readonly id: PeerId,
    network: Network,
    options: PeerOptions = {},
  ) {
    super();

    this.connection = new RTCPeerConnection(options.rtc);
    this.channel = this.connection.createDataChannel(SYSTEM_CHANNEL, { negotiated: true, id: 0 });
    this.channel.binaryType = "arraybuffer";
    this.handshake = new Handshake(me, id, this.connection, this.channel, network, undefined, options.timeout);

    this.channel.addEventListener("open", this.handleOpen);
    this.channel.addEventListener("close", this.handleClose);
    this.channel.addEventListener("message", this.handleMessage);
    this.connection.addEventListener("connectionstatechange", this.handleConnectionStateChange);
    this.handshake.addEventListener("error", this.handleHandshakeEvent);
    this.handshake.addEventListener("debug", this.handleHandshakeEvent);
  }

  get open() {
    return !this.closed && this.channel.readyState === "open";
  }

  /** Runs the handshake: as offerer without `offer`, as answerer with it. Closes the link if it fails. */
  async connect(offer?: Offer) {
    try
    {
      await this.handshake.start(offer);
    }
    catch
    {
      this.close();
    }
  }

  send(bytes: Uint8Array) {
    if (!this.open) return false;

    try
    {
      this.channel.send(bytes as Uint8Array<ArrayBuffer>);
      return true;
    }
    catch
    {
      return false;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;

    this.handshake.terminate();
    this.handshake.removeEventListener("error", this.handleHandshakeEvent);
    this.handshake.removeEventListener("debug", this.handleHandshakeEvent);
    this.channel.removeEventListener("open", this.handleOpen);
    this.channel.removeEventListener("close", this.handleClose);
    this.channel.removeEventListener("message", this.handleMessage);
    this.connection.removeEventListener("connectionstatechange", this.handleConnectionStateChange);
    this.channel.close();
    this.connection.close();

    this.dispatchEvent(new Event("close"));
  }

  // event handlers
  private handleOpen = () => {
    this.dispatchEvent(new Event("open"));
  }

  private handleClose = () => {
    this.close();
  }

  private handleMessage = (event: MessageEvent) => {
    if (!(event.data instanceof ArrayBuffer)) return;
    this.emit("message", new Uint8Array(event.data));
  }

  private handleConnectionStateChange = () => {
    const state = this.connection.connectionState;
    if (state === "failed" || state === "closed") this.close();
  }

  // forwards the handshake's error/debug events
  private handleHandshakeEvent = (event: Event) => {
    this.emit(event.type, (event as CustomEvent).detail);
  }
}
