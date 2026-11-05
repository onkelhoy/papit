import { Message, PeerId, read, SERVER, SignalType } from "@papit/peer-message";

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
 * It keeps one peer id: the first one the server assigned, or `resume`. A new connection gets a new
 * id, so it sends `signal.resume` first and holds the queue until the server agrees. A server without
 * resume answers `unsupported`; the socket then talks as the new id, the way it did before resume.
 *
 * @fires welcome - `CustomEvent<PeerId>`, ready to talk as `me` (again after every reconnect)
 * @fires open - connected (again)
 * @fires disconnect - the socket dropped, a reconnect is scheduled
 * @fires close - closed for good
 * @fires error - `type: "limit"` when `attempts` or `timeout` ran out, `type: "resume"` when the server refused the peer id (the socket closes)
 */
export class SocketLink extends Emitter implements Link {
  public readonly id = SERVER;
  /** The id this socket talks as, null until `"welcome"`. */
  public me: PeerId | null = null;
  /** The welcome token that proves the peer id, null when the server sends none. */
  public token: string | null = null;

  private ws: WebSocket | null = null;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private offline: Uint8Array[] = [];
  private welcomed = false;
  private peer: PeerId | null = null;
  // the resume under way: its message id and the id the server assigned this connection
  private resuming: { ref: string; id: PeerId } | null = null;
  private closed = false;
  private readonly maxAttempts: number;

  constructor(
    private readonly url: string | URL,
    private readonly options: SocketOptions = {},
  ) {
    super();
    this.maxAttempts = options.attempts ?? Infinity;
    this.peer = options.resume?.peer ?? null;
    this.token = options.resume?.token ?? null;
    this.startDeadline();
    this.connect();
  }

  get open() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Sends now, or queues until the server has welcomed the socket (again). False once closed for good. */
  send(bytes: Uint8Array) {
    if (this.closed) return false;
    if (!this.open || !this.welcomed)
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

    this.welcomed = false;
    this.resuming = null;
    ws.removeEventListener("message", this.handleMessage);
    ws.removeEventListener("error", this.handleError);
    ws.removeEventListener("open", this.handleOpen);
    ws.removeEventListener("close", this.handleClose);
    this.ws = null;
    return ws;
  }

  // what was queued under the previous id would be refused as a spoof
  private flush(previous: PeerId | null) {
    const queue = this.offline;
    this.offline = [];
    for (const bytes of queue)
    {
      const type = previous && previous !== this.me ? stale(bytes, previous) : null;
      if (type) this.debug("socket", `dropped a queued ${type}, it was sent under the previous socket id`, { previous });
      else this.ws!.send(bytes);
    }
  }

  // event handlers
  private handleOpen = () => {
    this.attempts = 0;
    this.clearDeadline();
    this.dispatchEvent(new Event("open"));
  }

  private handleMessage = (event: MessageEvent) => {
    if (!(event.data instanceof ArrayBuffer)) return;

    const bytes = new Uint8Array(event.data);
    const message = read(bytes);
    if (message?.meta.sender === SERVER) this.handleServer(message);

    this.emit("message", bytes);
  }

  private handleServer(message: Message) {
    const { type } = message.meta;
    if (type === SignalType.Welcome)
    {
      const { id, token } = message.payload as { id: PeerId; token?: string };
      if (this.peer === null || this.peer === id)
      {
        this.peer = id;
        if (token) this.token = token;
        return this.ready(id);
      }

      const resume = Message.Create({ type: SignalType.Resume, sender: id, receiver: SERVER }, this.token ? { peer: this.peer, token: this.token } : { peer: this.peer });
      this.resuming = { ref: resume.meta.id, id };
      this.ws!.send(resume.toBinary(true));
      return;
    }

    if (type === SignalType.Resumed && this.resuming) return this.ready(this.peer!);

    const resuming = this.resuming;
    if (type !== SignalType.Error || !resuming) return;
    const { code, message: reason, ref } = message.payload as { code: string; message: string; ref?: string };
    if (ref !== resuming.ref) return;

    if (code === "unsupported") return this.ready(resuming.id);
    this.error("resume", `the server refused the peer id ${this.peer}: ${reason}`, { peer: this.peer, code });
    this.close();
  }

  private ready(id: PeerId) {
    const previous = this.me;
    this.me = id;
    this.resuming = null;
    this.welcomed = true;
    this.flush(previous);
    this.emit("welcome", this.me);
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

function stale(bytes: Uint8Array, sender: PeerId) {
  const message = read(bytes);
  return message?.meta.sender === sender ? message.meta.type : null;
}
