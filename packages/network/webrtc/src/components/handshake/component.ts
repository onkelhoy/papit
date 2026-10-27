import { HandshakeType, Message as PeerMessage, PayloadMap } from "@papit/peer-message";

import { Emitter } from "../../emitter";
import type { Network } from "../network";
import type { HandshakeHooks, Message } from "./types";

/** A received `handshake.offer` payload. */
export type Offer = { description: RTCSessionDescriptionInit; streams?: PayloadMap[HandshakeType.Offer]["streams"] };

/** How long the first negotiation may take before it fails. */
export const HANDSHAKE_TIMEOUT = 15_000;

/**
 * Negotiates one `RTCPeerConnection` with `target` for the whole life of the link, exchanging
 * `handshake.*` messages through the `Network` (the server, or peers). `start()` resolves once the
 * system channel opens; after that it keeps renegotiating on `negotiationneeded` (new channels,
 * transceivers, direction changes) until `terminate()`.
 * Glare is resolved with perfect negotiation: the polite side (the lower id) rolls back, the other ignores.
 */
export class Handshake extends Emitter {

  /** Media hooks, set by the media manager before `start()`. */
  public hooks: HandshakeHooks = {};

  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ignoreOffer = false;
  private makingOffer = false;
  private connected = false;
  private terminated = false;
  private settle: { resolve: () => void; reject: (reason: string) => void } | null = null;
  // candidate counts by type ("host", "srflx", "relay", ...), for diagnosing failed connections
  private localCandidates: Record<string, number> = {};
  private remoteCandidates = 0;

  constructor(
    public readonly me: string,
    public readonly target: string,
    public readonly connection: RTCPeerConnection,
    public readonly channel: RTCDataChannel,
    public readonly network: Network,
    public readonly polite = me < target,
    private readonly timeout = HANDSHAKE_TIMEOUT,
  ) {
    super();

    this.connection.addEventListener("icecandidate", this.handleIceCandidate);
    this.connection.addEventListener("icecandidateerror", this.handleIceCandidateError);
    this.connection.addEventListener("signalingstatechange", this.handleSignalingStateChange);
    this.connection.addEventListener("iceconnectionstatechange", this.handleIceConnectionStateChange);
    this.connection.addEventListener("icegatheringstatechange", this.handleIceGatheringStateChange);
    this.connection.addEventListener("negotiationneeded", this.handleNegotiationNeeded);
    this.channel.addEventListener("open", this.handleChannelOpen);
    this.network.addEventListener("message", this.handleNetworkMessage);
  }

  /**
   * Starts negotiating: as the offerer without `offer`, as the answerer with the received `handshake.offer` payload.
   * Resolves once, when the system channel opens; rejects on failure, timeout or `terminate()` before that.
   */
  public start(offer?: Offer) {
    return new Promise<void>((resolve, reject) => {
      if (this.terminated) return void reject("terminated");
      if (this.connected || this.channel.readyState === "open")
      {
        this.connected = true;
        return void resolve();
      }

      this.settle = { resolve, reject };
      this.timer = setTimeout(() => this.fail("timeout"), this.timeout);

      if (offer) this.handleIncomingOffer(offer);
      else if (!this.makingOffer && this.connection.signalingState === "stable") this.createOffer();
    });
  }

  /** Stops listening and clears the timer, for when the link closes. A pending `start()` rejects with `"terminated"`. */
  public terminate() {
    if (this.terminated) return;
    this.terminated = true;

    this.connection.removeEventListener("icecandidate", this.handleIceCandidate);
    this.connection.removeEventListener("icecandidateerror", this.handleIceCandidateError);
    this.connection.removeEventListener("signalingstatechange", this.handleSignalingStateChange);
    this.connection.removeEventListener("iceconnectionstatechange", this.handleIceConnectionStateChange);
    this.connection.removeEventListener("icegatheringstatechange", this.handleIceGatheringStateChange);
    this.connection.removeEventListener("negotiationneeded", this.handleNegotiationNeeded);
    this.channel.removeEventListener("open", this.handleChannelOpen);
    this.network.removeEventListener("message", this.handleNetworkMessage);
    this.clearTimer();
    this.hooks = {};

    const settle = this.settle;
    this.settle = null;
    settle?.reject("terminated");
  }

  // private methods
  private clearTimer() {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Before the channel opened this fails the handshake; afterwards a failed renegotiation is only reported. */
  private fail(reason: string) {
    const state = this.state();
    this.error("handshake", `handshake with ${this.target} failed: ${reason} (signaling ${state.signaling}, ice ${state.ice}, gathering ${state.gathering}, local candidates ${JSON.stringify(state.localCandidates)}, remote candidates ${state.remoteCandidates})`, { target: this.target, reason, ...state });
    if (this.connected) return;

    const settle = this.settle;
    this.settle = null;
    this.terminate();
    settle?.reject(reason);
  }

  /** Snapshot of the connection, attached to failures. No local "srflx"/"relay" candidates means no STUN/TURN was reachable. */
  public state() {
    return {
      signaling: this.connection.signalingState,
      ice: this.connection.iceConnectionState,
      gathering: this.connection.iceGatheringState,
      connection: this.connection.connectionState,
      localCandidates: { ...this.localCandidates },
      remoteCandidates: this.remoteCandidates,
    };
  }

  private async createOffer() {
    if (this.terminated) return;

    try
    {
      this.makingOffer = true;
      await this.connection.setLocalDescription();
      if (this.terminated) return;
      this.send({ type: "offer", description: this.connection.localDescription!.toJSON(), streams: this.hooks.streams?.() });
    }
    catch (error)
    {
      // an offer from the other side won the race; we answer that one instead
      if (this.connection.signalingState !== "stable") return void this.debug("offer", "offer superseded", error);
      this.fail("create-offer");
    }
    finally
    {
      this.makingOffer = false;
    }
  }

  private async flushPendingIceCandidates() {
    const candidates = this.pendingIceCandidates;
    this.pendingIceCandidates = [];
    for (const candidate of candidates)
    {
      try
      {
        await this.connection.addIceCandidate(candidate);
      }
      catch (err)
      {
        this.debug("candidate-flush", "failed to add candidate while flushing", err);
      }
    }
  }

  // helper functions
  private send({ type, ...payload }: Message) {
    if (this.terminated) return;
    this.network.send(PeerMessage.Create({ type: `handshake.${type}`, sender: this.me, receiver: this.target }, payload), { preferServer: true });
  }

  // event handlers
  private handleNetworkMessage = (event: Event) => {
    const message = (event as CustomEvent<PeerMessage>).detail;
    if (!message || message.meta.receiver !== this.me || message.meta.sender !== this.target) return;

    switch (message.meta.type)
    {
      case HandshakeType.Answer:
        this.handleIncomingAnswer(message.payload.description);
        break;

      case HandshakeType.Offer:
        this.handleIncomingOffer(message.payload);
        break;

      case HandshakeType.Candidate:
        this.handleIncomingCandidate(message.payload.candidate);
        break;
    }
  }

  private handleNegotiationNeeded = () => {
    if (this.makingOffer) return;
    this.debug("negotiation", `renegotiating with ${this.target}`, null);
    this.createOffer();
  }

  private handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (!event.candidate) return;
    const type = event.candidate.type ?? "unknown";
    this.localCandidates[type] = (this.localCandidates[type] ?? 0) + 1;
    this.send({ type: "candidate", candidate: event.candidate.toJSON() });
  }

  private handleIceCandidateError = (event: Event) => {
    const { url, errorCode, errorText } = event as RTCPeerConnectionIceErrorEvent;
    this.debug("candidate", `ice candidate error ${errorCode} ${errorText} (${url})`, { url, errorCode, errorText });
  }

  private handleIceConnectionStateChange = () => {
    this.debug("ice-state", `ice connection state changed to: ${this.connection.iceConnectionState}`, null);
  }

  private handleIceGatheringStateChange = () => {
    this.debug("ice-gathering", `ice gathering state changed to: ${this.connection.iceGatheringState}`, this.connection.iceGatheringState === "complete" ? { localCandidates: { ...this.localCandidates } } : null);
  }

  private handleSignalingStateChange = () => {
    this.debug("signaling-state", `signaling state changed to: ${this.connection.signalingState}`, null);
  }

  private handleChannelOpen = () => {
    if (this.connected) return;
    this.connected = true;
    this.clearTimer();

    const settle = this.settle;
    this.settle = null;
    settle?.resolve();
  }

  // incoming event handlers
  private async handleIncomingOffer({ description, streams }: Offer) {
    try
    {
      const collision = this.makingOffer || this.connection.signalingState !== "stable";
      this.ignoreOffer = !this.polite && collision;
      if (this.ignoreOffer)
      {
        this.debug("glare", "ignoring offer, we are impolite", null);
        return;
      }

      this.hooks.offer?.(streams ?? {});
      if (this.connection.signalingState === "have-local-offer") await this.connection.setLocalDescription({ type: "rollback" });
      await this.connection.setRemoteDescription(description);
      await this.flushPendingIceCandidates();
      this.hooks.answer?.();

      await this.connection.setLocalDescription();
      if (this.terminated) return;
      this.send({ type: "answer", description: this.connection.localDescription!.toJSON() });
    }
    catch (error)
    {
      this.debug("answer", "failed to answer", error);
      this.fail("create-answer");
    }
  }

  private async handleIncomingAnswer(answer: RTCSessionDescriptionInit) {
    if (this.connection.signalingState !== "have-local-offer") return;

    try
    {
      await this.connection.setRemoteDescription(answer);
      await this.flushPendingIceCandidates();
    }
    catch
    {
      this.fail("handle-answer");
    }
  }

  private async handleIncomingCandidate(candidate: RTCIceCandidateInit) {
    this.remoteCandidates++;
    if (!this.connection.remoteDescription)
    {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try
    {
      await this.connection.addIceCandidate(candidate);
    }
    catch (err)
    {
      if (!this.ignoreOffer) this.debug("candidate", "failed to add candidate", err);
    }
  }
}
