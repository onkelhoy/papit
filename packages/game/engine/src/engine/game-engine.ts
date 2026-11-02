/**
 * @file owns the layers of a scene, one canvas each, and the one loop that runs them
 * @module engine
 * @author Henry Pap [onkelhoy@gmail.com]
 */

import type { GameObject } from "../components/gameobject";
import { Emitter } from "../components/gameobject/emitter";
import { InputEvents } from "../components/input";
import { World } from "../components/world";
import { EngineLayers, LayerSelector, Setting, SettingCallback, StandardSetting, Theme, WebGL2Setting, WebGLSetting } from "../types";
import { Layer2D } from "./layer-2d";
import { Layer3D } from "./layer-3d";
import { readTheme, watchTheme } from "./theme";

/** The most one frame can advance the game, so a backgrounded tab can't jump it. */
const MAX_DELTA_TIME = 0.1;
/** The most fixed steps one frame may catch up on, so a slow frame can't spiral. */
const MAX_FIXED_STEPS = 5;

export class GameEngine<const T extends readonly LayerSelector[] = readonly LayerSelector[]> extends Emitter {

    static instance: GameEngine | null = null;

    /** Every layer by lowercase name. An unnamed layer is `layer0`, `layer1`, … by position. */
    readonly layers: EngineLayers<T>;
    /** The first layer named `main` or `default`, otherwise the first layer. */
    readonly defaultLayer: Layer2D | Layer3D;
    /** The root of the object tree. */
    readonly world: World = new World(this as unknown as GameEngine);

    state: "running" | "paused" = "paused";
    /** The theme of the page while a layer has `theme: true`, otherwise always `"light"`. */
    theme: Theme = "light";
    /** Scales `deltaTime`: 0.5 is slow motion and 0 freezes the game. */
    timeScale = 1;
    /** Seconds the game has run, `timeScale` included. */
    time = 0;
    /** Seconds since the last frame, `timeScale` included. 0 on the first frame after a start. */
    deltaTime = 0;
    /** Seconds per fixed step. */
    readonly fixedDeltaTime = 1 / 60;
    /** Frames drawn so far. */
    frame = 0;

    private list: Array<Layer2D | Layer3D> = [];
    private callback: SettingCallback | null = null;
    private previous: number | null = null;
    private accumulator = 0;
    private timer: number | null = null;
    private inputEvents: InputEvents | null = null;

    /**
     * @param selectors a query, or the settings of a layer. Defaults to `"canvas"`.
     */
    constructor(...selectors: T) {
        super();
        const layers: Record<string, Layer2D | Layer3D> = {};
        const inputs: readonly LayerSelector[] = selectors.length === 0 ? ["canvas"] : selectors;

        inputs.forEach((selector, index) => {
            const setting = createSetting(selector);
            const name = layerName(setting.name, index, layers);
            const layer = setting.type === "2d"
                ? new Layer2D(setting as StandardSetting, name)
                : new Layer3D(setting as WebGLSetting | WebGL2Setting, name);

            layer.engine = this as unknown as GameEngine;
            layers[name] = layer;
            this.list.push(layer);

            if (setting.global) GameEngine.instance = this as unknown as GameEngine;
        });

        const defaults = this.list.filter(layer => layer.name === "main" || layer.name === "default");
        if (defaults.length > 1) console.warn("[warn engine] both main and default layers exist, using the first");

        this.layers = layers as EngineLayers<T>;
        this.defaultLayer = defaults[0] ?? this.list[0];

        if (this.list.some(layer => layer.setting.theme))
        {
            this.theme = readTheme(this.canvas);
            watchTheme(this.handletheme);
        }
    }

    /** Adds an object to the world. */
    add<O extends GameObject>(object: O) {
        return this.world.add(object);
    }
    /** Removes an object from the world. */
    remove(object: GameObject) {
        this.world.remove(object);
    }

    /** Keyboard, mouse and touch on the default layer, created on first use. */
    get input() {
        this.inputEvents ??= new InputEvents(this.canvas, { mouse: { pointerlock: undefined } });
        return this.inputEvents;
    }

    /** A layer by name in any case, for names only known at runtime. Without a name, the default layer. */
    layer(name?: string) {
        if (name === undefined) return this.defaultLayer;
        return (this.layers as Record<string, Layer2D | Layer3D>)[name.toLowerCase()] as Layer2D | Layer3D | undefined;
    }

    /** The colour that stands out on the current theme, for lines and text. */
    get foreground() {
        return this.theme === "dark" ? "white" : "black";
    }

    get canvas() {
        return this.defaultLayer.element;
    }
    get element() {
        return this.defaultLayer.element;
    }
    get setting() {
        return this.defaultLayer.setting;
    }
    get context() {
        return this.defaultLayer.context as CanvasRenderingContext2D;
    }
    get ctx() {
        return this.defaultLayer.context as CanvasRenderingContext2D;
    }
    static get ctx() {
        return this.instance?.ctx;
    }
    get gl() {
        return this.defaultLayer.context as WebGL2RenderingContext;
    }
    get gl1() {
        return this.defaultLayer.context as WebGLRenderingContext;
    }

    get width() {
        return this.defaultLayer.width;
    }
    get height() {
        return this.defaultLayer.height;
    }

    getSetting(index: number) {
        return this.list[index]?.setting;
    }
    getContext<T = CanvasRenderingContext2D>(index: number) {
        return this.list[index]?.context as T;
    }
    getElement(index: number) {
        return this.list[index]?.element;
    }
    getCanvas(index: number) { // this is mostly there as I'd probably forget about element : but element makes more sense as a name
        return this.list[index]?.element;
    }

    /** Starts the loop with a callback that runs every frame. */
    loop(callback: SettingCallback) {
        this.callback = callback;
        this.start();
    }

    /** Runs the first frame right away, the next ones on animation frames. */
    start() {
        if (this.state === "running") return;

        this.state = "running";
        this.previous = null;
        this.list.forEach(layer => layer.running = true);
        this.handleframe();
    }

    stop() {
        this.state = "paused";
        if (this.timer !== null) cancelAnimationFrame(this.timer);
        this.timer = null;

        this.list.forEach(layer => {
            layer.running = false;
            layer.resize();
        });
    }

    private handletheme = () => {
        const theme = readTheme(this.canvas);
        if (theme === this.theme) return;

        this.theme = theme;
        this.emit("theme", theme);

        // a running loop picks it up on its next frame, a stopped game has to draw once
        if (this.state === "paused" && this.frame > 0)
        {
            this.previous = null;
            this.handleframe();
        }
    }

    private handleframe = () => {
        const now = performance.now();
        const elapsed = this.previous === null ? 0 : (now - this.previous) / 1000;
        this.previous = now;

        this.deltaTime = Math.min(elapsed, MAX_DELTA_TIME) * this.timeScale;
        this.time += this.deltaTime;
        this.frame++;

        this.list.forEach(layer => layer.resize());

        this.fixedSteps();
        this.world.step("update", this.deltaTime);
        this.world.step("lateUpdate", this.deltaTime);
        this.list.forEach(layer => layer.camera?.step("lateUpdate", this.deltaTime));
        this.world.draw();
        this.list.forEach(layer => layer.finish());

        const delta = this.deltaTime * 1000;
        this.callback?.(delta, this.deltaTime);
        for (const layer of this.list)
        {
            for (const callback of layer.setting.callbacks) callback(delta, this.deltaTime);
        }

        if (this.state === "running") this.timer = requestAnimationFrame(this.handleframe);
    }

    private fixedSteps() {
        this.accumulator += this.deltaTime;

        let steps = 0;
        while (this.accumulator >= this.fixedDeltaTime && steps < MAX_FIXED_STEPS)
        {
            this.world.step("fixedUpdate", this.fixedDeltaTime);
            this.accumulator -= this.fixedDeltaTime;
            steps++;
        }
        if (steps === MAX_FIXED_STEPS) this.accumulator = 0;
    }
}

function createSetting(selector: LayerSelector) {
    const options = typeof selector === "string" ? { query: selector } : selector;

    return {
        ...options,
        query: options.query ?? "",
        type: options.type ?? "2d",
        global: options.global ?? false,
        callbacks: options.callbacks ?? [],
        theme: options.theme ?? false,
        documentElement: options.documentElement ?? document,
    } as Setting;
}

function layerName(name: string | undefined, index: number, layers: Record<string, unknown>) {
    const fallback = `layer${index}`;
    if (!name) return fallback;

    const lowercase = name.toLowerCase();
    if (!Object.hasOwn(layers, lowercase)) return lowercase;

    console.warn(`[warn engine] layer "${lowercase}" already exists, using "${fallback}" for this one`);
    return fallback;
}
