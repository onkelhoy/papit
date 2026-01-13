import { Emitter } from "../../emitter";
import { Message } from "../message";
import { SocketMessage, SocketMessageType } from "./types";

const MAX_ATTEMPTS = 10;
const RECONNECT_TIME_INTERVAL_STEP = 700; // with attempt=10 => 1400 (total time = 10850)

export class Socket extends Emitter {
  private ws!: WebSocket;
  private attempts = 0;
  private offline: Message[] = [];
  public id: string | null = null;

  constructor(
    private url: string | URL,
    private protocols?: string | string[] | undefined
  ) {
    super();
    this.reconnect();
  }

  // main function 
  private handleMessage = (event: MessageEvent) => {
    if (!(event.data instanceof Uint8Array)) return;

    // at this point we can just asume all messages are directly to us, mo one would send relay over 
    // socket - atleast its not ment to

    const message = Message.FromBinary<SocketMessageType>(event.data);
    switch (message.meta.type)
    {
      case "socket":
        const socketMessage = message.parse<SocketMessage>();
        this.handleSocketMessage(socketMessage);
        break;
      case "handshake":
      case "network":
        this.emit(message.meta.type, message);
        break;
    }
  }

  private handleSocketMessage(message: SocketMessage) {
    switch (message.type)
    {
      case "connected":
        this.id = message.id;
        this.dispatchEvent(new Event("connected"));
        break;
      case "error":
        this.error("signaling", message.error, null);
        break;
    }
  }


  // HELPERS 
  // getters & setters 
  get connected() {
    return this.ws.readyState === this.ws.OPEN;
  }
  get online() {
    if (this.ws.readyState === this.ws.CONNECTING) return true;
    return this.connected;
  }

  // public functions 
  public close() {
    if (!this.ws) return;

    this.ws.removeEventListener("error", this.handleError);
    this.ws.removeEventListener("message", this.handleMessage);
    this.ws.removeEventListener("open", this.handleOpen);
    this.ws.close();
  }

  public send(message: Message, offloading?: boolean) {
    if (!this.connected)
    {
      this.offline.push(message);
      return false;
    }

    this.ws.send(message.toBinary());

    if (!offloading) this.offload();
    return true;
  }
  private handleError = (event: Event) => {
    if (this.online)
    {
      this.error("event", event.type, { event });
      return;
    }

    if (this.attempts > MAX_ATTEMPTS)
    {
      this.error("limit", "attempts maxed out", { attempts: this.attempts });
      return;
    }
    this.attempts++;
    setTimeout(this.reconnect, (Math.sign(this.attempts) + (this.attempts / MAX_ATTEMPTS)) * RECONNECT_TIME_INTERVAL_STEP)
  }
  private handleOpen = () => {
    this.attempts = 0;
    this.offload();
  }
  private offload() {

    while (this.offline.length > 0)
    {
      const message = this.offline.pop();
      if (message) this.send(message, true);
    }
  }
  private handleClose = (event?: CloseEvent) => {
    this.close();
  }

  // private functions 
  private reconnect = () => {
    this.close(); // logs out socket if exists

    this.ws = new window.WebSocket(this.url, this.protocols);
    this.ws.addEventListener("message", this.handleMessage);
    this.ws.addEventListener("error", this.handleError);
    this.ws.addEventListener("open", this.handleOpen);
    this.ws.addEventListener("close", this.handleClose);
  }
}