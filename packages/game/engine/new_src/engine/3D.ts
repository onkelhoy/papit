import { ShaderSource } from "types";
import { Engine } from "./base";

export class Engine3D extends Engine {

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