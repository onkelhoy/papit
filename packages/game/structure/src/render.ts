import { GameObject } from "@papit/game-engine";
import type { Layer3D } from "@papit/game-engine";
import { upload, GPUMesh } from "@papit/game-mesh";
import type { Structure } from "./structure";

const PROGRAM = "papit-structure";
const UPLOAD = new Float32Array(16);

const VERTEX = `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
uniform mat4 uModel, uView, uProjection;
out vec3 vNormal; out vec4 vColor; out float vHeight;
void main() {
    vNormal = mat3(uModel) * normal;
    vHeight = (uModel * vec4(position, 1.0)).y;
    vColor = color;
    gl_Position = uProjection * uView * uModel * vec4(position, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uLight;
in vec3 vNormal; in vec4 vColor; in float vHeight; out vec4 outColor;
void main() {
    vec3 n = normalize(vNormal);
    float light = max(dot(n, uLight), 0.0) * .65 + .35 + n.y * .05;
    light *= clamp(.75 + vHeight * .08, .6, 1.15); // higher is brighter, so levels read apart
    outColor = vec4(vColor.rgb * light, vColor.a);
}`;

/**
 * Draws a `Structure` on a WebGL2 layer with a plain lit shader, uploading only rebuilt chunks.
 * A starting point; games with their own materials can read `structure.update()` themselves.
 */
export class StructureObject extends GameObject {
    readonly structure: Structure;
    /** direction toward the light, normalised in the shader */
    light: [number, number, number] = [.4, .8, .5];

    private gpus = new Map<string, GPUMesh>();
    private ready: Promise<WebGLProgram> | null = null;
    private program: WebGLProgram | null = null;

    constructor(structure: Structure) {
        super();
        this.structure = structure;
    }

    render(layer: Layer3D) {
        const gl = layer.gl;
        if (!this.program)
        {
            this.ready ??= layer.programs.has(PROGRAM)
                ? Promise.resolve(layer.programs.get(PROGRAM)!)
                : layer.createProgram(PROGRAM, VERTEX, FRAGMENT);
            this.ready.then((program) => this.program = program);
            return;
        }

        for (const chunk of this.structure.update())
        {
            this.gpus.get(chunk.key)?.destroy();
            if (chunk.mesh.positions.length === 0) this.gpus.delete(chunk.key);
            else this.gpus.set(chunk.key, upload(gl, chunk.mesh));
        }

        const camera = layer.camera;
        if (!camera) return;
        gl.useProgram(this.program);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        const location = (name: string) => gl.getUniformLocation(this.program!, name);
        gl.uniformMatrix4fv(location("uModel"), false, this.worldMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(location("uView"), false, camera.viewMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(location("uProjection"), false, camera.projectionMatrix.toFloat32(UPLOAD));
        const [x, y, z] = this.light;
        const length = Math.hypot(x, y, z) || 1;
        gl.uniform3f(location("uLight"), x / length, y / length, z / length);

        for (const gpu of this.gpus.values()) gpu.draw();
    }

    /** Frees GPU buffers. */
    destroy() {
        for (const gpu of this.gpus.values()) gpu.destroy();
        this.gpus.clear();
    }
}
