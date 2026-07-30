/**
 * @file this file is dedicated for all canvas related functionalities - this is rather simple 
 * @module engine
 * @author Henry Pap [onkelhoy@gmail.com]
 */

import {
    InfoType,
    Setting,
    SettingCallback,
    ShaderSource,
} from "./types";

/**
 * @typedef {object} EngineSettings
 * @property {string} [query]
 * @property {string} [type=2d]
 * @property {number} [width] 
 * @property {number} [height] 
 * @property {Function[]} [callbacks] 
 */

export class Engine {

    info: Array<InfoType> = [];

    // init with the default canvas size
    canvasToDisplaySizeMap: Map<HTMLCanvasElement, [number, number]> = new Map();
    resizeObserver: ResizeObserver;

    /**
     * 
     * @param  {...string|EngineSettings} selectors 
     */
    constructor(...selectors: (Partial<Setting> | string)[]) {
        // allows for multiple canvases to exist
        this.info = [];
        this.resizeObserver = new ResizeObserver(this.handleresize);

        if (selectors.length === 0) selectors.push('canvas');
        for (const selector of selectors)
        {
            const _setting: Partial<Setting> = {
                query: "",
                timer: null,
                width: undefined,
                height: undefined,
                state: "paused",
                previous: null,
                callbacks: [],
                documentElement: document,
                contextSetting: undefined,
            }
            if (typeof selector === "string")
            {
                _setting.query = selector;
                _setting.type = "2d"
            }
            else 
            {
                _setting.query = selector.query ?? "";
                _setting.width = selector.width;
                _setting.height = selector.height;
                _setting.callbacks = selector.callbacks ?? [];
                _setting.documentElement = selector.documentElement ?? document;

                if (!selector.type)
                {
                    _setting.type = "2d";
                }
                else 
                {
                    _setting.type = selector.type;
                    _setting.contextSetting = selector.contextSetting
                }
            }
            const setting = _setting as Setting;

            const element = setting.documentElement.querySelector<HTMLCanvasElement>(setting.query);
            if (!element) throw new Error(`[error engine] could not find element: [${setting.query}]`);

            try
            {
                // only call us of the number of device pixels changed
                this.resizeObserver.observe(element, { box: 'device-pixel-content-box' });
            } catch (ex)
            {
                // device-pixel-content-box is not supported so fallback to this
                this.resizeObserver.observe(element, { box: 'content-box' });
            }

            const context = element.getContext(setting.type, setting.contextSetting);
            if (context === null) throw new Error("[error engine] could not initialize context type make sure your browser support it: " + setting.type);

            if (!context) throw new Error('[error engine] could not create rendering context');
            let w = element.clientWidth;
            let h = element.clientHeight;
            if (setting.width) w = element.width = setting.width;
            if (setting.height) h = element.height = setting.height;

            this.canvasToDisplaySizeMap.set(element, [w, h]);

            let info: InfoType | null = null;

            if (["webgl", "webgl2"].includes(setting.type))
            {
                info = {
                    type: "webgl",
                    setting,
                    element,
                    context: context as WebGL2RenderingContext | WebGLRenderingContext,
                    programs: new Map(),
                }
            }
            else
            {
                info = {
                    type: "standard",
                    setting,
                    element,
                    context: context as CanvasRenderingContext2D,
                }
            }

            this.info.push(info);
        }
    }

    // resize 
    handleresize = (entries: ResizeObserverEntry[]) => {
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
            const displayWidth = Math.round(width * dpr);
            const displayHeight = Math.round(height * dpr);
            this.canvasToDisplaySizeMap.set(entry.target as HTMLCanvasElement, [displayWidth, displayHeight]);
        }
    }

    get canvas() {
        return this.getCanvas(0);
    }
    get element() {
        return this.getCanvas(0);
    }
    get setting() {
        return this.getSetting(0);
    }
    get context() {
        return this.getContext(0);
    }
    get ctx() {
        return this.getContext(0);
    }
    get gl() {
        return this.getContext<WebGL2RenderingContext>(0);
    }
    get gl1() {
        return this.getContext<WebGLRenderingContext>(0);
    }

    get width() {
        return this.canvas.width;
    }
    get height() {
        return this.canvas.height;
    }

    getSetting(index: number) {
        return this.info[index]?.setting;
    }
    getContext<T = CanvasRenderingContext2D>(index: number) {
        return this.info[index]?.context as T;
    }
    getElement(index: number) {
        return this.info[index]?.element;
    }
    getCanvas(index: number) { // this is mostly there as I'd probably forget about element : but element makes more sense as a name
        return this.info[index]?.element;
    }

    loop(callback: SettingCallback, index = 0) {
        const setting = this.getSetting(index);
        setting.state = "running";

        const loopfunction = () => {
            if (setting.state === "paused")
            {
                if (setting.timer !== null) cancelAnimationFrame(setting.timer);
                return;
            }

            let delta = -1;
            const now = performance.now();
            if (setting.previous)
            {
                delta = now - setting.previous;
            }
            setting.previous = now;
            if (callback) callback(delta);
            setting.callbacks.forEach(cb => cb(delta));
            setting.timer = requestAnimationFrame(loopfunction);
        }

        loopfunction();
    }
    stop(index: number = 0) {
        const setting = this.getSetting(index);
        if (setting)
        {
            setting.state = "paused"
        }
    }

    // CRED: https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
    resizeCanvasToDisplaySize(index: number = 0) {
        const context = this.getContext(index);
        if (!context)
        {
            console.error("could not find context");
            return false;
        }
        const canvas = context.canvas;

        const data = this.canvasToDisplaySizeMap.get(canvas);
        if (!data)
        {
            console.error("canvas is not in canvas display size");
            return false;
        }

        const [displayWidth, displayHeight] = data;

        // Check if the canvas is not the same size.
        const needResize = canvas.width !== displayWidth ||
            canvas.height !== displayHeight;

        if (needResize)
        {
            // Make the canvas the same size
            canvas.width = displayWidth;
            canvas.height = displayHeight;

            // dangerous call in case this is executed multiple times - should do it in a debounce 
            // canvas.dispatchEvent(new Event("needs-resize"));
        }

        return needResize;
    }

}


export function LoadImage(src: string): Promise<HTMLImageElement> {
    return new Promise(res => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            res(img);
        }
    });
}