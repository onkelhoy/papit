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

    static instance: Engine | null = null;
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
                global: false,
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
                _setting.global = selector.global ?? false;
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

            if (setting.global)
            {
                Engine.instance = this;
            }

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

    // WEBGL related 

    /**
     * This function will remove a selected program from the gl-context, errors are logged and null is returned 
     * @param name string - used to locate program 
     * @param index number - used to locate which context (defaults to first)
     * @returns true
     */
    deleteProgram(name: string, index: number = 0) {
        const info = this.info[index];
        if (info == null) throw new Error("info not found");
        if (info.type !== "webgl") throw new Error("context is not WebGL: " + info.setting.type);
        const program = info.programs.get(name as string);
        if (!program) throw new Error("program not found");

        const gl = info.context;
        gl.deleteProgram(program);
        return true;
    }
    /**
     * This function will remove a selected program from the gl-context, errors are logged and null is returned 
     * @param name string - used to locate program 
     * @param index number - used to locate which context (defaults to first)
     * @returns true | null
     */
    deleteProgramSafe(name: string, index: number = 0) {
        try
        {
            return this.deleteProgram(name, index);
        }
        catch (e)
        {
            console.error(e);
            return null;
        }
    }

    /**
     * This functions creates a program by accepting a vertex and a fragment shader, if error it throws a Error 
     * @param name string name of the program 
     * @param vertex ShaderSource
     * @param fragment ShaderSource
     * @param index number used to locate which context (defaults to first)
     * @returns WebGLProgram
     */
    async createProgram(name: string, vertex: ShaderSource, fragment: ShaderSource, index: number = 0) {
        const info = this.info[index];
        if (info == null) throw new Error("info not found");
        if (info.type !== "webgl") throw new Error("context is not WebGL: " + info.setting.type);
        if (info.programs.has(name)) throw new Error("program with this name already exist: " + name)
        const gl = info.context;

        const program = gl.createProgram();
        info.programs.set(name, program);

        // vertex shader 
        const vertexShader = await this.createShader("vertex", vertex, gl);
        gl.attachShader(program, vertexShader);

        // fragment shader 
        const fragmentShader = await this.createShader("fragment", fragment, gl);
        gl.attachShader(program, fragmentShader);

        // link the program/program 
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error("unable to link the program: " + log);
        }

        return program
    }
    /**
     * This functions creates a program by accepting a vertex and a fragment shader, if error it logs and returns null
     * @param name string name of the program 
     * @param vertex ShaderSource
     * @param fragment ShaderSource
     * @param index number used to locate which context (defaults to first)
     * @returns WebGLProgram | null
     */
    async createProgramSafe(name: string, vertex: ShaderSource, fragment: ShaderSource, index: number = 0) {
        try
        {
            return this.createProgram(name, vertex, fragment, index);
        }
        catch (e)
        {
            console.error(e);
            return null;
        }
    }
    /**
     * This function creates a shader from a source, if error it throws a Error 
     * @param type vertext | fragment
     * @param source ShaderSource
     * @param gl WebGLRenderingContext | WebGL2RenderingContext
     * @returns Promise WebGLShader
     */
    async createShader(type: "vertex" | "fragment", source: ShaderSource, gl: WebGLRenderingContext | WebGL2RenderingContext) {
        let shaderSource: string | null;
        if (typeof source === "string") shaderSource = source;
        else
        {
            const res = await fetch(source.url);
            const text = await res.text();
            shaderSource = text;
        }

        let shader: WebGLShader | null = null;

        if (type == "vertex") shader = gl.createShader(gl.VERTEX_SHADER);
        else if (type == "fragment") shader = gl.createShader(gl.FRAGMENT_SHADER);
        else
        {
            throw new Error("type must be either of type vertex or fragment: " + type);
        }

        if (shader == null)
        {
            throw new Error("could not create shader");
        }

        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);  // Clean up the shader
            throw new Error('[error] compiling shader: ' + error);
        }

        return shader;
    }
    /**
     * This function creates a shader from a source, if error it logs and returns null
     * @param type vertext | fragment
     * @param source ShaderSource
     * @param gl WebGLRenderingContext | WebGL2RenderingContext
     * @returns Promise WebGLShader | null
     */
    async createShaderSafe(type: "vertex" | "fragment", source: ShaderSource, gl: WebGLRenderingContext | WebGL2RenderingContext) {
        try
        {
            return this.createShader(type, source, gl);
        }
        catch (e)
        {
            console.error(e);
            return null;
        }
    }

    /**
     * sets the current program to context, if error it throws Error 
     * @param name string name of the program 
     * @param index number used to locate which context (defaults to first)
     */
    useProgram(name: string, index: number) {
        const info = this.info[index];
        if (info == null) throw new Error("info not found");
        if (info.type !== "webgl") throw new Error("context is not WebGL: " + info.setting.type);
        const program = info.programs.get(name as string);
        if (!program) throw new Error("program not found");

        const gl = info.context;
        gl.useProgram(program);
    }

    /**
     * sets the current program to context, if error it logs and return false 
     * @param name string name of the program 
     * @param index number used to locate which context (defaults to first)
     * @returns boolean state if success (true) or error
     */
    useProgramSafe(name: string, index: number) {
        try
        {
            this.useProgram(name, index);
            return true;
        }
        catch (e)
        {
            console.error(e);
            return false;
        }
    }
}