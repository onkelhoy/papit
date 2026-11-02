import { Layer } from "./layer";
import { ShaderSource, WebGLSetting, WebGL2Setting } from "../types";

/** One WebGL canvas, with helpers for its shader programs. */
export class Layer3D extends Layer<WebGLRenderingContext | WebGL2RenderingContext> {
    programs: Map<string, WebGLProgram> = new Map();

    constructor(setting: WebGLSetting | WebGL2Setting, name: string) {
        super(setting, name);
    }

    get gl() {
        return this.context as WebGL2RenderingContext;
    }
    get gl1() {
        return this.context as WebGLRenderingContext;
    }

    protected prepare() {
        const gl = this.context;
        gl.viewport(0, 0, this.width, this.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    /**
     * This function will remove a selected program from the gl-context, errors are logged and null is returned 
     * @param name string - used to locate program 
     * @returns true
     */
    deleteProgram(name: string) {
        const program = this.programs.get(name as string);
        if (!program) throw new Error("program not found");

        const gl = this.context;
        gl.deleteProgram(program);
        return true;
    }
    /**
     * This function will remove a selected program from the gl-context, errors are logged and null is returned 
     * @param name string - used to locate program 
     * @returns true | null
     */
    deleteProgramSafe(name: string) {
        try
        {
            return this.deleteProgram(name);
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
     * @returns WebGLProgram
     */
    async createProgram(name: string, vertex: ShaderSource, fragment: ShaderSource) {
        if (this.programs.has(name)) throw new Error("program with this name already exist: " + name)
        const gl = this.context;

        const program = gl.createProgram();
        this.programs.set(name, program);

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
     * @returns WebGLProgram | null
     */
    async createProgramSafe(name: string, vertex: ShaderSource, fragment: ShaderSource) {
        try
        {
            return this.createProgram(name, vertex, fragment);
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
     */
    useProgram(name: string) {
        const program = this.programs.get(name as string);
        if (!program) throw new Error("program not found");

        const gl = this.context;
        gl.useProgram(program);
    }

    /**
     * sets the current program to context, if error it logs and return false 
     * @param name string name of the program 
     * @returns boolean state if success (true) or error
     */
    useProgramSafe(name: string) {
        try
        {
            this.useProgram(name);
            return true;
        }
        catch (e)
        {
            console.error(e);
            return false;
        }
    }
}
