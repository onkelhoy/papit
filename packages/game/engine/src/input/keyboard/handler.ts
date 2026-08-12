import { logscreen } from "utils";
import { KeyInfo } from "./types";

export class Keyboard extends EventTarget {
    keys: Record<string, Partial<KeyInfo>>;
    verbose: boolean;

    constructor() {
        super();

        this.keys = {};
        this.verbose = false;
        document.addEventListener("keydown", this.handlekeydown, { passive: true });
        document.addEventListener("keyup", this.handlekeyup);
    }

    // on(key:string, callback:EventListener) {
    //   this.addEventListener(key, callback);
    // }
    on(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
        this.addEventListener(type, callback, options);
    }
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
        super.addEventListener(type, callback, options);
    }

    key(name: string) {
        return this.keys[name];
    }

    handlekeydown = (e: KeyboardEvent) => {
        const name = (e.key || e.code).toLowerCase();

        if (!this.keys[name])
        {
            this.keys[name] = { clicked: false };
        }

        if (this.keys[name].clicked === false)
        {
            this.keys[name].start = performance.now();
        }


        this.keys[name].clicked = true;
        this.keys[name].stop = null;

        if (this.verbose)
        {
            logscreen("keyup", name, this.keys[name]);
        }
        // this.dispatchEvent(new CustomEvent('key', { detail: {
        //   name,
        //   value: this.keys[name]
        // }}));
        this.dispatchEvent(new CustomEvent(`${name}-down`, {
            detail: {
                name,
                value: this.keys[name]
            }
        }));
        this.dispatchEvent(new CustomEvent(name, {
            detail: {
                name,
                value: this.keys[name]
            }
        }));
    }
    handlekeyup = (e: KeyboardEvent) => {
        const name = (e.key || e.code).toLowerCase();
        if (!this.keys[name])
        {
            // throw new Error("keyup event fired but no key registered: " + name);
        }

        this.keys[name].clicked = false;
        this.keys[name].stop = performance.now();

        if (this.verbose)
        {
            logscreen("keyup", name, this.keys[name]);
        }

        this.dispatchEvent(new CustomEvent(`${name}-up`, {
            detail: {
                name,
                value: this.keys[name]
            }
        }));
        this.dispatchEvent(new CustomEvent(name, {
            detail: {
                name,
                value: this.keys[name]
            }
        }));
    }
}