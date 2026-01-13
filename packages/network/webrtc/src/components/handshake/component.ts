import { Emitter } from "../../emitter";
import { Network, NetworkMessage } from "../network";
import { HandshakeMessage, Message } from "./types";

export class Handshake extends Emitter {

  private pendingIceCandidates: RTCIceCandidate[] = [];
  private iceRestarting = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly me: string,
    public readonly target: string,
    public readonly connection: RTCPeerConnection,
    public readonly network: Network,
  ) {
    super();

    this.connection.onicecandidate = this.handleicecandiate.bind(this);
    this.connection.onicecandidateerror = this.onicecandidateerror.bind(this);
    this.connection.onicegatheringstatechange = this.onicegatheringstatechange.bind(this);
    this.connection.oniceconnectionstatechange = this.oniceconnectionstatechange.bind(this);
    this.connection.onsignalingstatechange = this.onsignalingstatechange.bind(this);
    this.network.addEventListener("message", this.handlenetworkmessage); // cant bind this as we want to remove it later 
  }

  public start({ offer, option }: { offer?: RTCSessionDescriptionInit, option?: RTCOfferOptions }) {
    return new Promise<void>(async (resolve, reject) => {
      this.addEventListener("fatal", (event: Event) => {
        let reason = "unknown";
        if (event instanceof CustomEvent) reason = event.detail;
        reject(reason);
      });

      this.addEventListener("connected", () => {
        this.terminate();
        resolve();
      });

      if (offer) 
      {
        this.handleIncomingOffer(offer);
      }
      else 
      {
        this.createOffer(option);
      }
    });
  }

  private terminate() {
    this.network.removeEventListener("message", this.handlenetworkmessage);
    if (this.timer != null) clearTimeout(this.timer);
  }

  // private methods 
  private async createOffer(option?: RTCOfferOptions) {
    try 
    {
      const description = await this.connection.createOffer(option);
      await this.connection.setLocalDescription(description);

      this.send({ type: "offer", description });
    }
    catch 
    {
      this.emit("fatal", "create-offer");
    }
  }
  private async flushPendingIceCandidates() {
    // process any queued candidates
    for (let candidate of this.pendingIceCandidates)
    {
      try
      {
        await this.connection.addIceCandidate(candidate);
      } catch (err)
      {
        this.debug("candidate-flush", "failed to add candidate while flushing", err);
      }
    }
    this.pendingIceCandidates.forEach(c => this.connection.addIceCandidate(c));
    this.pendingIceCandidates = [];
  }

  // helper functions 
  private send(payload: Message) {
    this.network.send({
      meta: {
        type: "handshake",
        receiver: this.target,
        sender: this.me,
      },
      payload,
    });
  }

  // event handlers 
  private handlenetworkmessage = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const networkMessage = event.detail as NetworkMessage;
    if (networkMessage.meta.type !== "handshake") return;
    if (networkMessage.meta.receiver !== this.me) return;

    const message = event.detail as HandshakeMessage;
    switch (message.payload.type)
    {
      case "answer":
        this.handleIncomingAnswer(message.payload.description);
        break;

      case "offer":
        this.handleIncomingOffer(message.payload.description);
        break;

      case "candidate":
        this.handleIncomingCandidate(message.payload.candidate);
        break;

      default:
        this.error("network-message", "unknown handshake message type received", event);
        break;
    }
  }
  private handleicecandiate(event: RTCPeerConnectionIceEvent) {
    const { candidate } = event;
    if (!candidate) return;

    this.send({ type: "candidate", candidate });
  }
  private onicecandidateerror(event: RTCPeerConnectionIceErrorEvent) {
    this.error("candidate", "something went wrong with ice-candidate", event);
  }

  // state changing 
  private onicegatheringstatechange(event: Event) { // any idea what I should do with these states ? 
    switch (this.connection.iceGatheringState)
    {
      case "new":
      case "gathering":
      case "complete":
        this.debug("ice-gathering-state", `ice gathering state changed to: ${this.connection.iceGatheringState}`, event);
        break;
    }
  }
  private oniceconnectionstatechange(event: Event) {
    switch (this.connection.iceConnectionState)
    {
      case "new":
      case "checking":
      case "closed":
      case "disconnected":
      case "connected": // final state change for ICE 
        this.debug("ice-connection-state", `ice connection state changed to: ${this.connection.iceConnectionState}`, event);
        break;
      case "completed":
        this.dispatchEvent(new Event("connected"));
        break;
      case "failed":
        if (this.iceRestarting) return;
        this.iceRestarting = true;
        this.debug("ice-restart", "connection failed, trying iceRestart", event);
        this.createOffer({ iceRestart: true });
        this.timer = setTimeout(() => this.iceRestarting = false, 5000);
        break;
    }
  }
  private onsignalingstatechange(event: Event) { // any idea what I should do with these states ? 
    switch (this.connection.signalingState)
    {
      case "stable":
      case "have-local-offer":
      case "have-local-pranswer":
      case "have-remote-offer":
      case "have-remote-pranswer":
      case "closed":
        this.debug("signaling-state-change", `signaling state changed to: ${this.connection.signalingState}`, event);
        break;
    }
  }

  // incoming event handlers 
  private async handleIncomingOffer(offer: RTCSessionDescriptionInit) {
    try 
    {
      await this.connection.setRemoteDescription(offer);
      const description = await this.connection.createAnswer();
      await this.connection.setLocalDescription(description);

      // flush if any candidates 
      await this.flushPendingIceCandidates();

      this.send({ type: "answer", description });
    }
    catch 
    {
      this.emit("fatal", "create-answer");
    }
  }
  private async handleIncomingAnswer(answer: RTCSessionDescriptionInit) {
    try 
    {
      await this.connection.setRemoteDescription(answer);

      // flush if any candidates 
      await this.flushPendingIceCandidates();
    }
    catch 
    {
      this.emit("fatal", "handle-answer");
    }
  }
  private async handleIncomingCandidate(candidate: RTCIceCandidate) {
    if (!this.connection.remoteDescription)
    {
      this.pendingIceCandidates.push(candidate);
      return;
    }
    await this.connection.addIceCandidate(candidate)
  }
} 