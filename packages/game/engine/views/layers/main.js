import { GameEngine } from '@papit/game-engine';

const vertex = `#version 300 es
uniform float uAngle;
uniform float uAspect;
out vec3 vColor;
const vec3 colors[3] = vec3[3](vec3(1, .3, .3), vec3(.3, 1, .3), vec3(.3, .3, 1));
void main() {
    float angle = uAngle + float(gl_VertexID) * 2.094;
    vColor = colors[gl_VertexID];
    gl_Position = vec4(cos(angle) * .5 / uAspect, sin(angle) * .5, 0, 1);
}`;
const fragment = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main() { fragColor = vec4(vColor, 1); }`;

const engine = new GameEngine(
    { name: "map", query: "#map" },
    { name: "models", query: "#models", type: "webgl2", contextSetting: { alpha: true } },
);
window.engine = engine;

const { ctx } = engine.layers.map;
const { gl } = engine.layers.models;
const output = document.querySelector("output");
let program, angle, aspect;

function draw() {
    const { width, height } = engine.layers.map;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "oklch(60% 0.1 240)";
    const x = (engine.time * 200) % width;
    for (let i = 0; i < 12; i++)
    {
        ctx.fillRect((x + i * width / 12) % width, height / 2 - 4, 24, 8);
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(angle, engine.time);
    gl.uniform1f(aspect, gl.canvas.width / gl.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    output.textContent = `frame ${engine.frame}, ${engine.time.toFixed(2)} s`;
}

document.querySelector("button").addEventListener("click", event => {
    if (engine.state === "running") engine.stop();
    else engine.start();
    event.currentTarget.textContent = engine.state === "running" ? "pause" : "play";
});
document.querySelector("input").addEventListener("input", event => {
    engine.timeScale = Number(event.currentTarget.value);
});

program = await engine.layers.models.createProgram("triangle", vertex, fragment);
engine.layers.models.useProgram("triangle");
angle = gl.getUniformLocation(program, "uAngle");
aspect = gl.getUniformLocation(program, "uAspect");
engine.loop(draw);
