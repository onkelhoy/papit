import { Camera, GameEngine, GameObject, fps, orbit } from '@papit/game-engine';

const vertex = `#version 300 es
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
layout(location=0) in vec4 aPosition;
layout(location=1) in vec4 aColor;
out vec4 vColor;
void main() {
    vColor = aColor;
    gl_Position = uProjection * uView * uModel * aPosition;
}`;
const fragment = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 fragColor;
void main() { fragColor = vColor; }`;

// each face: normal axis, its sign and a color
const faces = [
    [0, -1, [0, 1, 1]], [0, 1, [1, 0, 1]],
    [1, -1, [0, 1, 0]], [1, 1, [1, 1, 0]],
    [2, -1, [0, 0, 1]], [2, 1, [1, 0, 0]],
];
const corners = [[-.5, -.5], [.5, -.5], [.5, .5], [.5, .5], [-.5, .5], [-.5, -.5]];

function cube() {
    const data = [];
    for (const [axis, sign, color] of faces)
    {
        for (const [a, b] of corners)
        {
            const point = [a, a, a];
            point[axis] = sign * .5;
            point[(axis + 1) % 3] = a;
            point[(axis + 2) % 3] = b;
            data.push(...point, ...color);
        }
    }
    return new Float32Array(data);
}

class Cube extends GameObject {
    constructor(uniforms, speed = 0) {
        super();
        this.uniforms = uniforms;
        this.speed = speed;
    }

    update(dt) {
        this.rotation.y += this.speed * dt;
    }

    render({ gl, camera }) {
        gl.uniformMatrix4fv(this.uniforms.model, false, this.worldMatrix);
        gl.uniformMatrix4fv(this.uniforms.view, false, camera.viewMatrix);
        gl.uniformMatrix4fv(this.uniforms.projection, false, camera.projectionMatrix);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }
}

const engine = new GameEngine({ name: "main", query: "canvas", type: "webgl2" });
window.engine = engine;

const layer = engine.layers.main;
const { gl } = layer;

const program = await layer.createProgram("cube", vertex, fragment);
layer.useProgram("cube");
gl.enable(gl.DEPTH_TEST);
gl.clearColor(0, 0, 0, 0);

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, cube(), gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
gl.enableVertexAttribArray(0);
gl.enableVertexAttribArray(1);

const uniforms = {
    model: gl.getUniformLocation(program, "uModel"),
    view: gl.getUniformLocation(program, "uView"),
    projection: gl.getUniformLocation(program, "uProjection"),
};

const center = engine.add(new Cube(uniforms, .5));
for (let i = 0; i < 6; i++)
{
    const moon = center.add(new Cube(uniforms));
    const angle = i * Math.PI / 3;
    moon.position.set([Math.cos(angle) * 2, 0, Math.sin(angle) * 2]);
    moon.scale.set([.4, .4, .4]);
}

const cameras = {
    orbit: () => new Camera({ controllers: [orbit({ distance: 6, yaw: .6, pitch: .4 })] }),
    fps: () => {
        const camera = new Camera({ controllers: [fps()] });
        camera.position.z = 6;
        return camera;
    },
    orthographic: () => new Camera({
        projection: "orthographic",
        zoom: .4,
        near: -50,
        far: 50,
        controllers: [orbit({ yaw: .6, pitch: .4 })],
    }),
};

document.querySelector("select").addEventListener("change", event => {
    layer.camera = cameras[event.currentTarget.value]();
});

layer.camera = cameras.orbit();
engine.start();
