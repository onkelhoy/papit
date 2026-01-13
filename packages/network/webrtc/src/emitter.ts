import { EmitterEvent } from "./types";

export abstract class Emitter extends EventTarget {
  public on(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    this.addEventListener(type, callback, options);
  }

  protected error(type: string, message: string, payload: any) {
    this.dispatchEvent(new CustomEvent<EmitterEvent>("error", { detail: { type, message, payload } }));
  }
  protected debug(type: string, message: string, payload: any) {
    this.dispatchEvent(new CustomEvent<EmitterEvent>("debug", { detail: { type, message, payload } }));
  }

  protected emit<T = any>(type: string, detail: T) {
    this.dispatchEvent(new CustomEvent<T>(type, { detail }));
  }
}