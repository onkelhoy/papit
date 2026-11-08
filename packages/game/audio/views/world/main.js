import "@papit/button";
import "@papit/joystick";
import { Camera, GameEngine, GameObject, orbit } from "@papit/game-engine";
import { AudioMixer } from "@papit/audio";
import { beep, blip } from "../mixer/sounds.js";

// shaders: one cube mesh, tinted per object, faces shaded by a fixed light
const vertex = `#version 300 es
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aShade;
out float vShade;
void main() {
    vShade = aShade;
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}`;
const fragment = `#version 300 es
precision mediump float;
uniform vec3 uColor;
in float vShade;
out vec4 fragColor;
void main() { fragColor = vec4(uColor * vShade, 1.0); }`;

const UPLOAD = new Float32Array(16);
const SHADES = [.6, .6, .5, 1, .8, .8];
const CORNERS = [[-.5, -.5], [.5, -.5], [.5, .5], [.5, .5], [-.5, .5], [-.5, -.5]];

function cube() {
    const data = [];
    for (let face = 0; face < 6; face++)
    {
        const axis = face >> 1;
        const sign = face & 1 ? .5 : -.5;
        for (const [a, b] of CORNERS)
        {
            const point = [0, 0, 0];
            point[axis] = sign;
            point[(axis + 1) % 3] = a;
            point[(axis + 2) % 3] = b;
            data.push(...point, SHADES[face]);
        }
    }
    return new Float32Array(data);
}

class Box extends GameObject {
    constructor(color) {
        super();
        this.color = new Float32Array(color);
    }

    render({ gl, camera }) {
        gl.uniform3fv(uniforms.color, this.color);
        gl.uniformMatrix4fv(uniforms.model, false, this.worldMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(uniforms.view, false, camera.viewMatrix.toFloat32(UPLOAD));
        gl.uniformMatrix4fv(uniforms.projection, false, camera.projectionMatrix.toFloat32(UPLOAD));
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }
}

// world layout: three biomes side by side along x
const BIOMES = [
    { name: "forest", from: -30, to: -10, color: [.25, .55, .3] },
    { name: "desert", from: -10, to: 10, color: [.85, .75, .45] },
    { name: "cave", from: 10, to: 30, color: [.3, .3, .38] },
];

/** A box that loops a sound at its position and pulses with the beat. */
class Emitter extends Box {
    constructor(color, sound, period) {
        super(color);
        this.sound = sound;
        this.period = period;
        this.time = 0;
        this.voice = null;
    }

    start() {
        const { x, y, z } = this.position;
        this.voice = mixer.play(this.sound, {
            bus: "ambience",
            loop: true,
            spatial: { position: { x, y, z }, refDistance: 2, rolloff: 1.5 },
        });
    }

    update(dt) {
        this.time = (this.time + dt) % this.period;
        const size = 1 + .4 * Math.max(0, 1 - this.time * 6);
        this.scale.set([size, size, size]);
    }
}

class Player extends Box {
    constructor() {
        super([.9, .35, .3]);
        this.speed = 8;
    }

    update(dt) {
        const keys = keyboard;
        // keyboard plus the touch joystick (its y points down the screen)
        const forward = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0) - joystick.y;
        const side = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0) + joystick.x;
        if (forward === 0 && side === 0) return;

        // move relative to where the camera looks
        const yaw = layer.camera.rotation.y;
        const length = Math.hypot(forward, side);
        const step = this.speed * dt / Math.max(length, 1);
        this.position.x += (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * step;
        this.position.z += (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * step;
        this.position.x = Math.min(Math.max(this.position.x, -29), 29);
        this.position.z = Math.min(Math.max(this.position.z, -9), 9);
        this.rotation.y = yaw;
    }
}

// audio
const mixer = new AudioMixer();
window.mixer = mixer;
await Promise.all([
    mixer.load("forest", "public/songs/cara-a-cara.mp3", { stream: true }),
    mixer.load("desert", "public/songs/dust-and-steel.mp3", { stream: true }),
    mixer.load("cave", "public/songs/guardians-watch.mp3", { stream: true }),
]);
mixer.add("blip", await blip());
mixer.add("bird", await beep(1760, .5));
mixer.add("drum", await beep(110, 1));
mixer.add("drip", await beep(660, 1.5));

// engine
const engine = new GameEngine({ name: "main", query: "canvas", type: "webgl2" });
window.engine = engine;
const layer = engine.layers.main;
const { gl } = layer;

const program = await layer.createProgram("box", vertex, fragment);
layer.useProgram("box");
gl.enable(gl.DEPTH_TEST);
gl.clearColor(.55, .7, .85, 1);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, cube(), gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
gl.enableVertexAttribArray(0);
gl.enableVertexAttribArray(1);

const uniforms = {
    model: gl.getUniformLocation(program, "uModel"),
    view: gl.getUniformLocation(program, "uView"),
    projection: gl.getUniformLocation(program, "uProjection"),
    color: gl.getUniformLocation(program, "uColor"),
};

for (const biome of BIOMES)
{
    const ground = engine.add(new Box(biome.color));
    ground.position.set([(biome.from + biome.to) / 2, -.55, 0]);
    ground.scale.set([biome.to - biome.from, .1, 20]);
}

const emitters = [
    [[.2, .8, .3], "bird", .5, [-22, 1, -4]],
    [[.95, .55, .2], "drum", 1, [3, .5, 5]],
    [[.5, .6, 1], "drip", 1.5, [22, 2, -3]],
].map(([color, sound, period, position]) => {
    const emitter = engine.add(new Emitter(color, sound, period));
    emitter.position.set(position);
    emitter.start();
    return emitter;
});

const player = engine.add(new Player());
layer.camera = new Camera({ controllers: [orbit({ target: player, distance: 8, pitch: .35, min: 3, max: 30 })] });

const joystick = document.querySelector("#controls");

// keyboard, kept to a set so the frame loop reads it without allocating
const keyboard = new Set();
addEventListener("keydown", event => keyboard.add(event.key.toLowerCase()));
addEventListener("keyup", event => keyboard.delete(event.key.toLowerCase()));
addEventListener("blur", () => keyboard.clear());

// listener and biome music, checked every frame with reused objects
const UP = { x: 0, y: 1, z: 0 };
const ear = { x: 0, y: 0, z: 0 };
const facing = { x: 0, y: 0, z: -1 };
const seconds = document.querySelector("#seconds");
const curve = document.querySelector("#curve");
const biomeOutput = document.querySelector("#biome");
let biome = null;

engine.loop(() => {
    ear.x = player.position.x;
    ear.y = player.position.y;
    ear.z = player.position.z;
    const yaw = layer.camera.rotation.y;
    facing.x = -Math.sin(yaw);
    facing.z = -Math.cos(yaw);
    mixer.setListener(ear, facing, UP);

    const next = BIOMES.find(b => ear.x >= b.from && ear.x < b.to) ?? null;
    if (next === biome) return;
    biome = next;
    biomeOutput.value = biome?.name ?? "-";
    const options = { seconds: Number(seconds.value), curve: curve.value };
    if (biome) mixer.music.play(biome.name, options);
    else mixer.music.stop(options);
});

// controls
const state = document.querySelector("#state");
state.value = mixer.state;
mixer.addEventListener("statechange", () => state.value = mixer.state);
seconds.addEventListener("input", () => seconds.nextElementSibling.value = seconds.value);
document.querySelector("#sfx").addEventListener("click", () => mixer.play("blip", { bus: "sfx" }));
document.querySelector("#blip").addEventListener("press", () => mixer.play("blip", { bus: "sfx" }));
for (const slider of document.querySelectorAll("[data-bus]"))
{
    const bus = slider.dataset.bus === "master" ? mixer.master : mixer.bus(slider.dataset.bus);
    slider.addEventListener("input", () => bus.fadeTo(Number(slider.value), { seconds: 0.05 }));
}

engine.start();
