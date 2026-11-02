import { Camera, GameEngine, GameObject, orbit } from "@papit/game-engine";

const vertex = `#version 300 es
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
out float vLight;
void main() {
    vLight = .55 + .45 * max(0., dot(normalize(mat3(uModel) * aNormal), normalize(vec3(.4, 1., .6))));
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.);
}`;
const fragment = `#version 300 es
precision mediump float;
uniform vec3 uColor;
in float vLight;
out vec4 fragColor;
void main() { fragColor = vec4(uColor * vLight, 1.); }`;

/** A box from 0 to 1 along X and -.5 to .5 on the other axes, so it sits on a bone from head to tail. */
function box() {
    const data = [];
    const corners = [[-.5, -.5], [.5, -.5], [.5, .5], [.5, .5], [-.5, .5], [-.5, -.5]];

    for (let axis = 0; axis < 3; axis++)
    {
        for (const sign of [-1, 1])
        {
            for (const [a, b] of sign < 0 ? [...corners].reverse() : corners)
            {
                const point = [0, 0, 0];
                const normal = [0, 0, 0];
                point[axis] = sign * .5;
                point[(axis + 1) % 3] = a;
                point[(axis + 2) % 3] = b;
                normal[axis] = sign;
                data.push(point[0] + .5, point[1], point[2], ...normal);
            }
        }
    }
    return new Float32Array(data);
}

const model = new Float32Array(16);

/** Sets up a WebGL canvas, an orbit camera and a `draw` for boxes. */
export async function stage({ distance = 8, yaw = .6, pitch = .35 } = {}) {
    const engine = new GameEngine({ name: "main", query: "canvas", type: "webgl2" });
    const layer = engine.layers.main;
    const { gl } = layer;

    const program = await layer.createProgram("box", vertex, fragment);
    layer.useProgram("box");
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, box(), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);

    const uniforms = {
        model: gl.getUniformLocation(program, "uModel"),
        view: gl.getUniformLocation(program, "uView"),
        projection: gl.getUniformLocation(program, "uProjection"),
        color: gl.getUniformLocation(program, "uColor"),
    };

    layer.camera = new Camera({ controllers: [orbit({ distance, yaw, pitch })] });

    /** Draws a box at a matrix, stretched `length` along X and `width` across. */
    function draw(matrix, length, width, color) {
        for (let i = 0; i < 3; i++)
        {
            model[i] = matrix[i] * length;
            model[4 + i] = matrix[4 + i] * width;
            model[8 + i] = matrix[8 + i] * width;
        }
        model[12] = matrix[12];
        model[13] = matrix[13];
        model[14] = matrix[14];
        model[15] = 1;

        gl.uniform3fv(uniforms.color, color);
        gl.uniformMatrix4fv(uniforms.model, false, model);
        gl.uniformMatrix4fv(uniforms.view, false, layer.camera.viewMatrix);
        gl.uniformMatrix4fv(uniforms.projection, false, layer.camera.projectionMatrix);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }

    /** A cube at a point, for targets and feet. */
    function marker(point, size, color) {
        model.fill(0);
        model[0] = model[5] = model[10] = 1;
        model[12] = point[0] - size / 2;
        model[13] = point[1];
        model[14] = point[2];
        draw(model.slice(), size, size, color);
    }

    return { engine, draw, marker };
}

export const BLUE = [.43, .56, .85];
export const ORANGE = [.85, .54, .43];
export const GREEN = [.31, .7, .53];
export const GROUND = [.5, .5, .52];

/** Draws every bone of an armature as a box. */
export class Rig3D extends GameObject {
    constructor(armature, draw, width = .16) {
        super();
        this.armature = armature;
        this.drawBox = draw;
        this.width = width;
    }

    render() {
        for (const bone of this.armature.bones)
        {
            this.drawBox(bone.worldMatrix, bone.length, this.width, BLUE);
        }
    }
}
