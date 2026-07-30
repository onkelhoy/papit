import { Vector2 } from "@papit/vector";
import { ButtonState, Setting, MouseEventMap, MouseButtonMap } from "./types";

export class Mouse extends EventTarget {
    position: Vector2;
    movement: Vector2;
    setting: Setting;
    lastpointerlock: number;
    clicked: boolean;
    verbose: boolean;
    click: {
        start: null | number;
        end: null | number;
        button: null | ButtonState;
    }
    pointerlocktimer: NodeJS.Timeout | null = null;

    constructor(canvas: HTMLCanvasElement, setting: Setting) {
        super();
        // x = 0, y = 0
        this.position = Vector2.zero;
        this.movement = Vector2.zero;
        this.setting = setting;

        this.lastpointerlock = performance.now() - 1000;

        this.clicked = false;
        this.verbose = false;
        this.click = {
            start: null,
            end: null,
            button: null,
        };

        if (setting.pointerlock)
        {
            canvas.addEventListener("click", this.handlepointersetup);
            document.addEventListener("pointerlockchange", this.handlepointerlockchange, false);
            document.addEventListener("pointerlockerror", this.handlepointerlockerror, false);
        }
        else
        {
            // this.position.set(canvas.offsetLeft + canvas.width/2, canvas.offsetTop + canvas.height/2);
            document.addEventListener("mousemove", this.handlemousemove, { passive: true });
        }
        canvas.addEventListener("mousedown", this.handlemousedown);
        canvas.addEventListener("mouseup", this.handlemouseup);
    }

    on<K extends keyof MouseEventMap>(type: K, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
        this.addEventListener(type, callback, options);
    }

    addEventListener<K extends keyof MouseEventMap>(type: K, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
        super.addEventListener(type, callback, options);
    }

    handlemousemove = (e: MouseEvent) => {
        if (document.pointerLockElement)
        {
            this.position.add(e.movementX, e.movementY);
            this.movement.set([e.movementX, e.movementY]);
        }
        else
        {
            const dx = this.position.x - e.clientX;
            const dy = this.position.y - e.clientY;
            this.position.set([e.clientX, e.clientY]);
            this.movement.set([dx, dy]);
        }
        this.dispatchEvent(new Event("move"));
    }
    handlemousedown = (e: MouseEvent) => {
        this.clicked = true;
        this.click.start = performance.now();
        this.click.end = null;
        if (e.target && 'button' in e.target)
        {
            this.click.button = MouseButtonMap[e.target.button as 1 | 2 | 3]; // FIXME
        }
        this.dispatchEvent(new Event("down"));
    }
    handlemouseup = (e: MouseEvent) => {
        this.clicked = false;
        this.click.end = performance.now();
        this.click.button = null;
        this.dispatchEvent(new Event("up"));
    }

    draw(ctx: CanvasRenderingContext2D, strokecolor = "black", fillcolor = "rgba(0,0,0,0.1)", thickness = 1) {
        ctx.fillStyle = fillcolor;
        ctx.strokeStyle = strokecolor;
        ctx.lineWidth = thickness;

        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // event handlers
    handlepointersetup = (e: MouseEvent) => {
        if (document.pointerLockElement) return;
        const canvas = e.target as HTMLCanvasElement;
        const { clientX, clientY } = e;
        const time = Math.max(0, 1500 - (performance.now() - this.lastpointerlock));
        this.position.set([clientX, clientY]);

        if (this.pointerlocktimer) clearTimeout(this.pointerlocktimer);
        this.pointerlocktimer = setTimeout(async () => {

            try
            {
                // REFERENCE:: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API#handling_promise_and_non-promise_versions_of_requestpointerlock
                await canvas.requestPointerLock(this.setting.pointerlock);
            }
            catch (error: unknown)
            {
                console.log('pointer lock error', error)
                if (error instanceof Error)
                {
                    if (error.name === "NotSupportedError" && this.setting.pointerlock?.unadjustedMovement)
                    {
                        // Some platforms may not support unadjusted movement.
                        // You can request again a regular pointer lock.
                        return canvas.requestPointerLock();
                    }
                }
            }
        }, time)
    }
    handlepointerlockchange = (e: Event) => {
        this.lastpointerlock = performance.now();
        if (document.pointerLockElement)
        {
            console.log("The pointer lock status is now locked");
            document.addEventListener("mousemove", this.handlemousemove, { passive: true });
        } else
        {
            console.log("The pointer lock status is now unlocked");
            document.removeEventListener("mousemove", this.handlemousemove, false);
        }
    }
    handlepointerlockerror = (e: Event) => {
        console.error('pointer lock failed', e);
    }
}