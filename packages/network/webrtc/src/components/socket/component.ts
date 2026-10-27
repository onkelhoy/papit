import { PeerId, read, SERVER, SignalType } from "@papit/peer-message";

import { Emitter } from "../../emitter";
import type { Link } from "../link";
import type { SocketOptions } from "./types";

const RECONNECT_TIME_INTERVAL_STEP = 700;
/** Longest wait between two connection attempts. */
export const MAX_RECONNECT_DELAY = 5000;

/**
 * `Link` to the signalling server over a WebSocket (`id` is `SERVER`). Keeps trying to connect, and to
 * reconnect, with a backoff capped at `MAX_RECONNECT_DELAY`, and queues what is sent meanwhile, in order.
 * `"close"` fires only once it gives up (`attempts`, `timeout`) or `close()` is called.
 *
 * @fires welcome - `CustomEvent<PeerId>`, the server assigned this client's id (again after every reconnect)
 * @fires open - connected (again)
 * @fires disconnect - the socket dropped, a reconnect is scheduled
 * @fires close - closed for good
 * @fires error - `type: "limit"` when `attempts` or `timeout` ran out
 */
export class SocketLink extends Emitter implements Link {
  public readonly id = SERVER;
  /** The id the server assigned, null until `"welcome"`. */
  public me: PeerId | null = null;

  private ws: WebSocket | null = null;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private offline: Uint8Array[] = [];
  private closed = false;
  private readonly maxAttempts: number;

  constructor(
    private readonly url: string | URL,
    private readonly options: SocketOptions = {},
  ) {
    super();
    this.maxAttempts = options.attempts ?? Infinity;
    this.startDeadline();
    this.connect();
  }

  get open() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Sends now, or queues until the socket is (re)connected. False once closed for good. */
  send(bytes: Uint8Array) {
    if (this.closed) return false;
    if (!this.open)
    {
      this.offline.push(bytes.slice());
      return true;
    }

    this.ws!.send(bytes);
    return true;
  }

  close() {
    if (this.closed) return;
    this.closed = true;

    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.clearDeadline();
    this.offline = [];
    this.detach()?.close();

    this.dispatchEvent(new Event("close"));
  }

  // private
  private connect = () => {
    this.timer = null;
    if (this.closed) return;

    this.detach()?.close();

    const ws = new WebSocket(this.url, this.options.protocols);
    ws.binaryType = "arraybuffer";
    ws.addEventListener("message", this.handleMessage);
    ws.addEventListener("error", this.handleError);
    ws.addEventListener("open", this.handleOpen);
    ws.addEventListener("close", this.handleClose);
    this.ws = ws;
  }

  private startDeadline() {
    if (this.options.timeout === undefined || this.deadline !== null) return;
    this.deadline = setTimeout(() => {
      this.deadline = null;
      this.error("limit", `no connection within ${this.options.timeout}ms`, { timeout: this.options.timeout });
      this.close();
    }, this.options.timeout);
  }

  private clearDeadline() {
    if (this.deadline !== null) clearTimeout(this.deadline);
    this.deadline = null;
  }

  private detach() {
    const ws = this.ws;
    if (!ws) return null;

    ws.removeEventListener("message", this.handleMessage);
    ws.removeEventListener("error", this.handleError);
    ws.removeEventListener("open", this.handleOpen);
    ws.removeEventListener("close", this.handleClose);
    this.ws = null;
    return ws;
  }

  private flush() {
    const queue = this.offline;
    this.offline = [];
    for (const bytes of queue)
    {
      this.ws!.send(bytes);
    }
  }

  // event handlers
  private handleOpen = () => {
    this.attempts = 0;
    this.clearDeadline();
    this.flush();
    this.dispatchEvent(new Event("open"));
  }

  private handleMessage = (event: MessageEvent) => {
    if (!(event.data instanceof ArrayBuffer)) return;

    const bytes = new Uint8Array(event.data);
    const message = read(bytes);
    if (message?.meta.type === SignalType.Welcome && message.meta.sender === SERVER)
    {
      this.me = message.payload.id;
      this.emit("welcome", this.me);
    }

    this.emit("message", bytes);
  }

  private handleError = (event: Event) => {
    this.debug("socket", "websocket error", event);
  }

  private handleClose = () => {
    this.detach();
    if (this.closed) return;

    if (this.attempts >= this.maxAttempts)
    {
      this.error("limit", "reconnect attempts maxed out", { attempts: this.attempts });
      this.close();
      return;
    }

    this.attempts++;
    this.startDeadline();
    const delay = Math.min(MAX_RECONNECT_DELAY, this.attempts * RECONNECT_TIME_INTERVAL_STEP);
    this.emit("disconnect", { attempts: this.attempts, delay });
    this.timer = setTimeout(this.connect, delay);
  }
}
