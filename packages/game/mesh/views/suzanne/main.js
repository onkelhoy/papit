import { Camera, GameEngine, GameObject, orbit } from '@papit/game-engine';
import { loadGLTF, upload } from '@papit/game-mesh';

// Suzanne exported from Blender (public/models/make.py), drag to orbit, wheel to zoom
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
    outColor = vec4(vColor.rgb * light, 1.0);
}`;

class Model extends GameObject {
    constructor(gpus, uniforms) {
        super();
        this.gpus = gpus;
        this.uniforms = uniforms;
        this.speed = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : .3;
    }

    update(dt) {
        this.rotation.y += this.speed * dt;
    }

    render({ gl, camera }) {
        gl.uniformMatrix4fv(this.uniforms.model, false, this.worldMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(this.uniforms.view, false, camera.viewMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(this.uniforms.projection, false, camera.projectionMatrix.toFloat32(UPLOAD));
        for (const gpu of this.gpus) gpu.draw();
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

const gltf = await loadGLTF("public/models/suzanne.glb");
engine.add(new Model(gltf.meshes.flatMap(mesh => mesh.primitives.map(primitive => upload(gl, primitive))), uniforms));

layer.camera = new Camera({ controllers: [orbit({ distance: 6, yaw: .5, pitch: .3 })] });
engine.start();
