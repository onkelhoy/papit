import { Vector2 } from "@papit/vector";
import { TouchesEventMap } from "./types";
import { logscreen } from "utils/helper";

export class ExtendedTouch {
    position: Vector2;
    movement: Vector2;

    start: number;
    end: null | number;
    identifier!: number;
    screenX!: number;
    screenY!: number;
    clientX!: number;
    clientY!: number;
    pageX!: number;
    pageY!: number;
    radiusX!: number;
    radiusY!: number;
    rotationAngle!: number;
    force!: number;
    target!: EventTarget;

    constructor(touch: Touch) {
        this.position = Vector2.zero;
        this.movement = Vector2.zero;

        this.start = performance.now();
        this.end = null;

        this.update(touch);
    }

    get id() {
        return this.identifier;
    }

    update(touch: Touch) {
        this.identifier = touch.identifier;
        this.screenX = touch.screenX;
        this.screenY = touch.screenY;
        this.clientX = touch.clientX;
        this.clientY = touch.clientY;
        this.pageX = touch.pageX;
        this.pageY = touch.pageY;
        this.radiusX = touch.radiusX;
        this.radiusY = touch.radiusY;
        this.rotationAngle = touch.rotationAngle;
        this.force = touch.force;
        this.target = touch.target;

        if (this.position === null)
        {
            this.movement = Vector2.zero;
            this.position = new Vector2(this.clientX, this.clientY);
        }
        else 
        {
            const old = this.position.clone;
            this.position.set([this.clientX, this.clientY]);
            this.movement = Vector2.subtract(this.position, old);
        }
    }

    release() {
        this.end = performance.now();
        return this;
    }
}

export class Touches extends EventTarget {
    mouse: ExtendedTouch | null;
    position: Vector2;
    movement: Vector2;
    touches: Record<number, ExtendedTouch>;
    changedTouches: ExtendedTouch[];
    verbose: boolean;

    constructor(canvas: HTMLCanvasElement) {
        super();
        this.position = Vector2.zero; // first move 
        this.movement = Vector2.zero;
        this.mouse = null;

        this.touches = {};
        this.changedTouches = [];
        this.verbose = false;

        canvas.addEventListener("touchstart", this.handletouchstart, { passive: true });
        canvas.addEventListener("touchend", this.handletouchend);
        canvas.addEventListener("touchmove", this.handletouchmove, { passive: true });
        canvas.addEventListener("touchcancel", this.handletouchcancel);
    }

    // public function
    on<K extends keyof TouchesEventMap>(type: K, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
        this.addEventListener(type, callback, options);
    }

    addEventListener<K extends keyof TouchesEventMap>(type: K, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
        super.addEventListener(type, callback, options);
    }

    // event handlers 
    handletouchstart = (e: TouchEvent) => {
        this.changedTouches = [];

        const oldmouse = this.mouse?.id;
        for (const eventtouch of e.changedTouches)
        {
            const touch = this.touchChange(eventtouch);
            this.mouse = touch;
            this.position.set(touch.position);
            this.movement.set(touch.movement);
        }


        const lastdown = oldmouse !== this.mouse?.id;
        if (lastdown)
        {
            this.dispatchEvent(new Event("last-down"));
        }

        if (this.verbose)
        {
            logscreen("touch start", lastdown);
        }
        this.dispatchEvent(new Event("down"));
    }
    handletouchend = (e: TouchEvent) => {
        this.changedTouches = [];

        for (const eventtouch of e.changedTouches)
        {
            const touch = this.touchChange(eventtouch);
            touch.release();
            delete this.touches[touch.id]

            if (touch === this.mouse)
            {
                this.position.set(touch.position);
                this.movement.set(touch.movement);
                this.mouse = null;
                this.dispatchEvent(new Event("last-up"));
            }
        }

        if (this.verbose)
        {
            logscreen("touch end");
        }
        this.dispatchEvent(new Event("up"));
    }
    handletouchmove = (e: TouchEvent) => {
        this.changedTouches = [];

        for (const eventtouch of e.changedTouches)
        {
            const touch = this.touchChange(eventtouch);

            if (touch === this.mouse)
            {
                this.position.set(touch.position);
                this.movement.set(touch.movement);

                this.dispatchEvent(new Event("last-move"));
            }
        }

        this.dispatchEvent(new Event("move"));
    }
    handletouchcancel = (e: TouchEvent) => {
        this.changedTouches = [];

        for (const eventtouch of e.changedTouches)
        {
            const touch = this.touchChange(eventtouch);
            touch.release();

            delete this.touches[touch.id]

            if (touch === this.mouse)
            {
                this.mouse = null;
                this.dispatchEvent(new Event("last-up"));
            }
        }

        this.position.set([0, 0]);
        this.movement.set([0, 0]);

        this.dispatchEvent(new Event("cancel"));
    }

    // helper 
    touchChange(touch: Touch) {
        const id = touch.identifier;
        if (this.touches[id])
        {
            this.touches[id].update(touch);
        }
        else 
        {
            this.touches[id] = new ExtendedTouch(touch);
        }

        this.changedTouches.push(this.touches[id]);
        return this.touches[id];
    }
}