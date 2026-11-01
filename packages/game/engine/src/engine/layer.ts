import type { Camera } from "../components/camera";
import { Setting } from "../types";
import type { GameEngine } from "./game-engine";

/**
 * One canvas of the scene. Sizes itself on creation and follows its element after that:
 * the observer records the new size, and `resize()` applies it.
 */
export abstract class Layer<Context extends RenderingContext = RenderingContext> {
    readonly name: string;
    readonly setting: Setting;
    readonly element: HTMLCanvasElement;
    readonly context: Context;
    /** Set by the engine while its loop runs, a running layer resizes before it draws. */
    running = false;
    /** Set by the engine that owns this layer. */
    engine: GameEngine | null = null;

    private currentCamera: Camera | null = null;

    private preparedFrame = -1;
    private displayWidth: number;
    private displayHeight: number;
    private observer: ResizeObserver;

    constructor(setting: Setting, name: string) {
        this.setting = setting;
        this.name = name;

        const element = setting.documentElement.querySelector<HTMLCanvasElement>(setting.query);
        if (!element) throw new Error(`[error engine] could not find element: [${setting.query}]`);
        this.element = element;

        const context = element.getContext(setting.type, setting.contextSetting);
        if (!context) throw new Error("[error engine] could not initialize context type make sure your browser support it: " + setting.type);
        this.context = context as Context;

        if (setting.width) element.width = setting.width;
        if (setting.height) element.height = setting.height;

        // an element without layout has no size yet, the observer reports it once it does
        this.displayWidth = Math.round(element.clientWidth * window.devicePixelRatio) || element.width;
        this.displayHeight = Math.round(element.clientHeight * window.devicePixelRatio) || element.height;
        this.resize();

        this.observer = new ResizeObserver(this.handleresize);
        try
        {
            // only call us of the number of device pixels changed
            this.observer.observe(element, { box: "device-pixel-content-box" });
        } catch (ex)
        {
            // device-pixel-content-box is not supported so fallback to this
            this.observer.observe(element, { box: "content-box" });
        }
    }

    /** What this layer is seen through. Without one, world units are canvas pixels. */
    get camera() {
        return this.currentCamera;
    }
    set camera(value: Camera | null) {
        this.currentCamera?.detach();
        this.currentCamera = value;
        value?.attach(this);
    }

    get canvas() { // this is mostly there as I'd probably forget about element : but element makes more sense as a name
        return this.element;
    }
    get width() {
        return this.element.width;
    }
    get height() {
        return this.element.height;
    }

    /**
     * Readies this layer for an object to draw on. The first object of a frame also clears it,
     * a layer nothing draws on keeps what was painted by hand.
     */
    place(matrix: Float32Array, frame: number) {
        if (this.preparedFrame !== frame)
        {
            this.preparedFrame = frame;
            this.prepare();
        }
    }

    /** Resets what `place` changed, so a loop callback draws on a plain canvas. */
    finish() { }

    protected abstract prepare(): void;

    /**
     * Applies the size of the element to the canvas, a width or height from the settings stays as it is.
     * Setting a canvas size clears it, so a running loop calls this before it draws.
     * @returns whether the size changed
     */
    resize() {
        const width = this.setting.width || this.displayWidth;
        const height = this.setting.height || this.displayHeight;
        if (this.element.width === width && this.element.height === height) return false;

        this.element.width = width;
        this.element.height = height;
        return true;
    }

    // CRED: https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
    private handleresize = (entries: ResizeObserverEntry[]) => {
        for (const entry of entries)
        {
            let width;
            let height;
            let dpr = window.devicePixelRatio;
            if (entry.devicePixelContentBoxSize)
            {
                // NOTE: Only this path gives the correct answer
                // The other paths are imperfect fallbacks
                // for browsers that don't provide anyway to do this
                width = entry.devicePixelContentBoxSize[0].inlineSize;
                height = entry.devicePixelContentBoxSize[0].blockSize;
                dpr = 1; // it's already in width and height
            } else if (entry.contentBoxSize[0])
            {
                width = entry.contentBoxSize[0].inlineSize;
                height = entry.contentBoxSize[0].blockSize;
            } else
            {
                width = entry.contentRect.width;
                height = entry.contentRect.height;
            }
            this.displayWidth = Math.round(width * dpr);
            this.displayHeight = Math.round(height * dpr);

            if (!this.running) this.resize();
        }
    }
}
