import type { Mesh } from "./types";

/** Fixed attribute locations, use them with `layout(location = n)` in shaders. */
export const ATTRIBUTES = { position: 0, normal: 1, color: 2, uv: 3, joints: 4, weights: 5 } as const;

export type GPUMesh = {
    vao: WebGLVertexArrayObject;
    /** vertices, or indices when indexed */
    count: number;
    /** `gl.UNSIGNED_SHORT` / `gl.UNSIGNED_INT`, or `null` for `drawArrays` */
    indexType: number | null;
    /** bind and draw as triangles */
    draw(): void;
    /** free the VAO and buffers */
    destroy(): void;
};

/** Upload a mesh to WebGL2: one buffer per attribute at `ATTRIBUTES`, plus indices. */
export function upload(gl: WebGL2RenderingContext, mesh: Mesh): GPUMesh {
    const vao = gl.createVertexArray()!;
    const buffers: WebGLBuffer[] = [];
    gl.bindVertexArray(vao);

    const attribute = (location: number, data: Float32Array | Uint16Array | undefined, size: number, integer = false) => {
        if (!data) return;
        const buffer = gl.createBuffer()!;
        buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location);
        if (integer) gl.vertexAttribIPointer(location, size, gl.UNSIGNED_SHORT, 0, 0);
        else gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };

    attribute(ATTRIBUTES.position, mesh.positions, 3);
    attribute(ATTRIBUTES.normal, mesh.normals, 3);
    attribute(ATTRIBUTES.color, mesh.colors, 4);
    attribute(ATTRIBUTES.uv, mesh.uvs, 2);
    attribute(ATTRIBUTES.joints, mesh.joints, 4, true);
    attribute(ATTRIBUTES.weights, mesh.weights, 4);
    // no colours: constant white
    if (!mesh.colors) gl.vertexAttrib4f(ATTRIBUTES.color, 1, 1, 1, 1);

    let indexType: number | null = null;
    if (mesh.indices)
    {
        const buffer = gl.createBuffer()!;
        buffers.push(buffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
        indexType = mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    }

    gl.bindVertexArray(null);
    const count = mesh.indices ? mesh.indices.length : mesh.positions.length / 3;

    return {
        vao, count, indexType,
        draw() {
            gl.bindVertexArray(vao);
            if (indexType === null) gl.drawArrays(gl.TRIANGLES, 0, count);
            else gl.drawElements(gl.TRIANGLES, count, indexType, 0);
            gl.bindVertexArray(null);
        },
        destroy() {
            for (const buffer of buffers) gl.deleteBuffer(buffer);
            gl.deleteVertexArray(vao);
            buffers.length = 0;
        },
    };
}
