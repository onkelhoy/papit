// A tiny line renderer for the 3D views: an orbit camera and one dynamic line buffer.
// Same file in every intersection package's views/3d, keep the copies in sync.
import { Camera, GameEngine, GameObject, orbit } from '@papit/game-engine';

/** float32 scratch for matrix uploads, the matrices themselves are float64 */
const UPLOAD = new Float32Array(16);

const vertex = `#version 300 es
uniform mat4 uView;
uniform mat4 uProjection;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aColor;
out vec3 vColor;
void main() {
    vColor = aColor;
    gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}`;
const fragment = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main() { fragColor = vec4(vColor, 1.0); }`;

export const GREY = [.55, .55, .55];
export const GREEN = [.1, .8, .3];
export const RED = [.95, .2, .2];
export const BLUE = [.4, .6, 1];
export const YELLOW = [1, .75, .1];

const FLOATS = 6; // x y z r g b
const CAPACITY = 20000; // vertices

/** Collects lines each frame, then draws them in one call. */
class Wire extends GameObject {
    constructor(gl, uniforms, paint) {
        super();
        this.gl = gl;
        this.uniforms = uniforms;
        this.paint = paint;
        this.data = new Float32Array(CAPACITY * FLOATS);
        this.count = 0;
    }

    update(dt) {
        this.count = 0;
        this.grid(4, GREY);
        this.paint(this, dt);
    }

    render({ gl, camera }) {
        gl.uniformMatrix4fv(this.uniforms.view, false, camera.viewMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(this.uniforms.projection, false, camera.projectionMatrix.toFloat32(UPLOAD));
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * FLOATS);
        gl.drawArrays(gl.LINES, 0, this.count);
    }

    vertex(x, y, z, color) {
        if (this.count >= CAPACITY) return;
        const i = this.count++ * FLOATS;
        this.data[i] = x; this.data[i + 1] = y; this.data[i + 2] = z;
        this.data[i + 3] = color[0]; this.data[i + 4] = color[1]; this.data[i + 5] = color[2];
    }

    line(a, b, color) {
        this.vertex(a.x, a.y, a.z ?? 0, color);
        this.vertex(b.x, b.y, b.z ?? 0, color);
    }

    /** a small cross */
    point(p, color, size = .06) {
        const z = p.z ?? 0;
        this.vertex(p.x - size, p.y, z, color); this.vertex(p.x + size, p.y, z, color);
        this.vertex(p.x, p.y - size, z, color); this.vertex(p.x, p.y + size, z, color);
        this.vertex(p.x, p.y, z - size, color); this.vertex(p.x, p.y, z + size, color);
    }

    /** a line from `from` along `direction` times `length`, with a cross at the tip */
    arrow(from, direction, length, color) {
        const to = {
            x: from.x + direction.x * length,
            y: from.y + direction.y * length,
            z: (from.z ?? 0) + (direction.z ?? 0) * length,
        };
        this.line(from, to, color);
        this.point(to, color, .04);
    }

    /** axis-aligned box from its min corner and size */
    box(x, y, z, w, h, d, color) {
        const X = x + w, Y = y + h, Z = z + d;
        const edges = [
            [x, y, z, X, y, z], [x, Y, z, X, Y, z], [x, y, Z, X, y, Z], [x, Y, Z, X, Y, Z],
            [x, y, z, x, Y, z], [X, y, z, X, Y, z], [x, y, Z, x, Y, Z], [X, y, Z, X, Y, Z],
            [x, y, z, x, y, Z], [X, y, z, X, y, Z], [x, Y, z, x, Y, Z], [X, Y, z, X, Y, Z],
        ];
        for (const [ax, ay, az, bx, by, bz] of edges)
        {
            this.vertex(ax, ay, az, color);
            this.vertex(bx, by, bz, color);
        }
    }

    /** three great circles */
    sphere(cx, cy, cz, r, color, segments = 32) {
        for (let axis = 0; axis < 3; axis++)
        {
            for (let i = 0; i < segments; i++)
            {
                this.ring(cx, cy, cz, r, axis, i / segments, color);
                this.ring(cx, cy, cz, r, axis, (i + 1) / segments, color);
            }
        }
    }

    ring(cx, cy, cz, r, axis, t, color) {
        const a = t * Math.PI * 2;
        const u = Math.cos(a) * r, v = Math.sin(a) * r;
        if (axis === 0) this.vertex(cx, cy + u, cz + v, color);
        else if (axis === 1) this.vertex(cx + u, cy, cz + v, color);
        else this.vertex(cx + u, cy + v, cz, color);
    }

    /** floor grid at y = 0 */
    grid(size, color) {
        for (let i = -size; i <= size; i++)
        {
            this.vertex(i, 0, -size, color); this.vertex(i, 0, size, color);
            this.vertex(-size, 0, i, color); this.vertex(size, 0, i, color);
        }
    }
}

/**
 * Starts a webgl2 engine on the page's canvas with an orbit camera.
 * `draw(wire, dt)` runs every frame and adds the lines to show.
 */
export async function createScene(draw, camera = { distance: 7, yaw: .6, pitch: .45 }) {
    const engine = new GameEngine({ name: "main", query: "canvas", type: "webgl2" });
    const layer = engine.layers.main;
    const { gl } = layer;

    const program = await layer.createProgram("wire", vertex, fragment);
    layer.useProgram("wire");
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, CAPACITY * FLOATS * 4, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, FLOATS * 4, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, FLOATS * 4, 12);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);

    const uniforms = {
        view: gl.getUniformLocation(program, "uView"),
        projection: gl.getUniformLocation(program, "uProjection"),
    };

    const wire = engine.add(new Wire(gl, uniforms, draw));
    layer.camera = new Camera({ controllers: [orbit(camera)] });
    engine.start();
    return { engine, wire };
}
