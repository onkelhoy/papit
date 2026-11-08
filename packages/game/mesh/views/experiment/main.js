import { Camera, GameEngine, GameObject, orbit } from '@papit/game-engine';
import { MeshBuilder, upload } from '@papit/game-mesh';

// builder shapes, each a GameObject spinning in place
const UPLOAD = new Float32Array(16);

const vertex = `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
uniform mat4 uModel, uView, uProjection;
out vec3 vNormal; out vec4 vColor;
void main() {
    vNormal = mat3(uModel) * normal;
    vColor = color;
    gl_Position = uProjection * uView * uModel * vec4(position, 1.0);
}`;
const fragment = `#version 300 es
precision mediump float;
in vec3 vNormal; in vec4 vColor; out vec4 outColor;
void main() {
    float light = max(dot(normalize(vNormal), normalize(vec3(.4, .8, .6))), 0.0) * .7 + .3;
    outColor = vec4(vColor.rgb * light, vColor.a);
}`;

class Shape extends GameObject {
    constructor(gpu, uniforms, speed = .6) {
        super();
        this.gpu = gpu;
        this.uniforms = uniforms;
        this.speed = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : speed;
    }

    update(dt) {
        this.rotation.y += this.speed * dt;
    }

    render({ gl, camera }) {
        gl.uniformMatrix4fv(this.uniforms.model, false, this.worldMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(this.uniforms.view, false, camera.viewMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(this.uniforms.projection, false, camera.projectionMatrix.toFloat32(UPLOAD));
        this.gpu.draw();
    }
}

const engine = new GameEngine({ name: "main", query: "canvas", type: "webgl2" });
const layer = engine.layers.main;
const { gl } = layer;

const program = await layer.createProgram("mesh", vertex, fragment);
layer.useProgram("mesh");
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.clearColor(0, 0, 0, 0);

const uniforms = {
    model: gl.getUniformLocation(program, "uModel"),
    view: gl.getUniformLocation(program, "uView"),
    projection: gl.getUniformLocation(program, "uProjection"),
};

const B = () => new MeshBuilder();
const tree = B()
    .cylinder("#7a4b2a", { scale: [.3, 1, .3] }, 6)
    .cone("#3f8f3a", { at: [0, .8, 0], scale: [1.2, 1.4, 1.2] }, 7);
const meshes = [
    B().box("#e0653a").build(),
    B().sphere(p => p[1] > 0 ? "#4a90d9" : "#2c5f9e", { scale: .6 }, 1).build(),
    B().sphere("#d9c64a", { scale: .6 }, 2).build({ smooth: true }),
    B().cylinder("#8a5cd6", { at: [0, -.5, 0] }, 10).build(),
    B().cone("#4ad98a", { at: [0, -.5, 0] }, 8).build(),
    B().add(tree, { at: [0, -.6, 0], scale: .7 }).build(),
];
meshes.forEach((mesh, i) => {
    const shape = engine.add(new Shape(upload(gl, mesh), uniforms));
    shape.position.set([(i % 3 - 1) * 2.2, i < 3 ? 1.2 : -1.2, 0]);
});

layer.camera = new Camera({ controllers: [orbit({ distance: 8, pitch: .3 })] });
engine.start();
