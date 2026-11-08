import { Camera, GameEngine, GameObject, orbit } from '@papit/game-engine';
import { loadGLTF, upload, rig, sample, SKINNING_GLSL } from '@papit/game-mesh';

// a tentacle rigged in Blender: its animation, or bend it by hand
const UPLOAD = new Float32Array(16);
const form = document.querySelector("form");
if (matchMedia("(prefers-reduced-motion: reduce)").matches) form.animate.checked = false;

const skinVertex = `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
${SKINNING_GLSL}
uniform mat4 uView, uProjection;
out vec3 vNormal; out vec4 vColor;
void main() {
    mat4 skin = skinMatrix();
    vNormal = mat3(skin) * normal;
    vColor = color;
    gl_Position = uProjection * uView * skin * vec4(position, 1.0);
}`;
const skinFragment = `#version 300 es
precision mediump float;
in vec3 vNormal; in vec4 vColor; out vec4 outColor;
void main() {
    float light = max(dot(normalize(vNormal), normalize(vec3(.4, .8, .6))), 0.0) * .7 + .3;
    outColor = vec4(vColor.rgb * light, 1.0);
}`;
const boneVertex = `#version 300 es
layout(location = 0) in vec3 position;
uniform mat4 uView, uProjection;
void main() {
    gl_Position = uProjection * uView * vec4(position, 1.0);
    gl_PointSize = 8.0;
}`;
const boneFragment = `#version 300 es
precision mediump float;
uniform vec4 uColor; out vec4 outColor;
void main() { outColor = uColor; }`;

const engine = new GameEngine({ name: "main", query: "canvas", type: "webgl2" });
const layer = engine.layers.main;
const { gl } = layer;

const skinProgram = await layer.createProgram("skin", skinVertex, skinFragment);
const boneProgram = await layer.createProgram("bones", boneVertex, boneFragment);
gl.enable(gl.CULL_FACE);
gl.clearColor(0, 0, 0, 0);
const uniform = (program, name) => gl.getUniformLocation(program, name);

const gltf = await loadGLTF("public/models/tentacle.glb");
const body = gltf.meshes[0].primitives[0];
const skeleton = rig(gltf);

// a second copy coloured by each vertex's joint weights
const PALETTE = [[.9, .3, .3], [.95, .6, .2], [.9, .85, .2], [.3, .8, .4], [.3, .6, .95], [.65, .4, .9]];
const weighted = { ...body, colors: new Float32Array(body.colors.length) };
for (let v = 0; v < body.positions.length / 3; v++)
{
    for (let k = 0; k < 4; k++)
    {
        const colour = PALETTE[body.joints[v * 4 + k] % PALETTE.length], weight = body.weights[v * 4 + k];
        for (let c = 0; c < 3; c++) weighted.colors[v * 4 + c] += colour[c] * weight;
    }
    weighted.colors[v * 4 + 3] = 1;
}

class Tentacle extends GameObject {
    time = 0;
    plain = upload(gl, body);
    weights = upload(gl, weighted);

    update(dt) {
        if (form.animate.checked)
        {
            this.time += dt;
            sample(gltf.animations[0], this.time, skeleton);
        }
        else
        {
            // by hand: every bone but the root bends around z and twists around its own y
            const bend = form.bend.valueAsNumber * .25, twist = form.twist.valueAsNumber * .2;
            const cz = Math.cos(bend), sz = Math.sin(bend), cy = Math.cos(twist), sy = Math.sin(twist);
            skeleton.bones.forEach((bone, i) => { if (i) bone.rotation.set([sz * sy, cz * sy, sz * cy, cz * cy]); });
        }
        skeleton.armature.update();
    }

    render({ gl, camera }) {
        layer.useProgram("skin");
        gl.enable(gl.DEPTH_TEST);
        gl.uniformMatrix4fv(uniform(skinProgram, "uView"), false, camera.viewMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(uniform(skinProgram, "uProjection"), false, camera.projectionMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(uniform(skinProgram, "jointMatrices"), false, skeleton.update());
        (form.weights.checked ? this.weights : this.plain).draw();
    }
}

// head to tail, tail one unit along the bone's local +y
class Bones extends GameObject {
    lines = new Float32Array(skeleton.bones.length * 6);
    buffer = gl.createBuffer();
    vao = gl.createVertexArray();

    constructor() {
        super();
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.lines.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    }

    render({ gl, camera }) {
        if (!form.bones.checked) return;
        skeleton.bones.forEach((bone, i) => {
            const [x, y, z, w] = bone.worldRotation;
            const ax = 2 * (x * y - z * w), ay = 1 - 2 * (x * x + z * z), az = 2 * (y * z + x * w);
            this.lines.set([bone.head[0], bone.head[1], bone.head[2], bone.head[0] + ax, bone.head[1] + ay, bone.head[2] + az], i * 6);
        });
        layer.useProgram("bones");
        gl.disable(gl.DEPTH_TEST);
        gl.uniformMatrix4fv(uniform(boneProgram, "uView"), false, camera.viewMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(uniform(boneProgram, "uProjection"), false, camera.projectionMatrix.toFloat32(UPLOAD));
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lines);
        gl.uniform4f(uniform(boneProgram, "uColor"), 1, 1, 1, 1);
        gl.drawArrays(gl.LINES, 0, skeleton.bones.length * 2);
        gl.uniform4f(uniform(boneProgram, "uColor"), 1, .85, .2, 1);
        gl.drawArrays(gl.POINTS, 0, skeleton.bones.length * 2);
        gl.bindVertexArray(null);
    }
}

engine.add(new Tentacle());
engine.add(new Bones());

const center = new GameObject();
center.position.set([0, 3, 0]);
layer.camera = new Camera({ controllers: [orbit({ target: center, distance: 9, yaw: .6, pitch: .2 })] });
engine.start();
