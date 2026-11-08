// component
import { penetration, distance, transformed, sphereSupport, boxSupport, capsuleSupport, hullSupport } from '@papit/gjk';

// view
import { createScene, GREY, GREEN, RED, YELLOW } from './wire.js';

const octahedron = [
    { x: .7, y: 0, z: 0 }, { x: -.7, y: 0, z: 0 },
    { x: 0, y: .8, z: 0 }, { x: 0, y: -.8, z: 0 },
    { x: 0, y: 0, z: .5 }, { x: 0, y: 0, z: -.5 },
];

/** each shape: its support in local space and its outline as local segments */
const kinds = {
    box: {
        convex: boxSupport({ x: -.5, y: -.5, z: -.5, w: 1, h: 1, d: 1 }),
        segments: boxSegments(.5),
    },
    sphere: {
        convex: sphereSupport({ x: 0, y: 0, z: 0, r: .6 }),
        segments: sphereSegments(.6),
    },
    capsule: {
        convex: capsuleSupport({ a: { x: 0, y: -.4, z: 0 }, b: { x: 0, y: .4, z: 0 }, r: .35 }),
        segments: capsuleSegments(.4, .35),
    },
    hull: {
        convex: hullSupport(octahedron),
        segments: hullSegments(octahedron),
    },
};

// a and b: a kind plus a live column-major 4x4 that gjk reads on every support call
const a = body("box");
const b = body("sphere");

const form = document.querySelector("form");
for (const select of form.querySelectorAll("select"))
{
    for (const name of Object.keys(kinds)) select.add(new Option(name, name));
}
form.a.value = "box";
form.b.value = "sphere";
form.addEventListener("change", () => {
    setKind(a, form.a.value);
    setKind(b, form.b.value);
});

let time = 0;
await createScene((wire, dt) => {
    if (!form.pause.checked) time += dt;

    place(a, 0, 1, 0, time * .3);
    place(b, Math.sin(time * .6) * 2.2, 1 + Math.sin(time * .9) * .4, Math.cos(time * .5) * .5, -time * .7);

    const hit = penetration(a.convex, b.convex);
    const color = hit ? GREEN : GREY;
    outline(wire, a, color);
    outline(wire, b, color);

    if (hit)
    {
        wire.arrow(position(b), hit.normal, hit.depth, RED);
        return;
    }
    const gap = distance(a.convex, b.convex);
    if (gap)
    {
        wire.line(gap.pointA, gap.pointB, YELLOW);
        wire.point(gap.pointA, YELLOW);
        wire.point(gap.pointB, YELLOW);
    }
});

function body(kind) {
    const matrix = new Float64Array(16);
    const result = { matrix };
    setKind(result, kind);
    return result;
}
function setKind(body, kind) {
    body.kind = kinds[kind];
    body.convex = transformed(body.kind.convex, body.matrix);
}

/** rotation about y, then a move */
function place(body, x, y, z, angle) {
    const m = body.matrix, c = Math.cos(angle), s = Math.sin(angle);
    m.fill(0);
    m[0] = c; m[2] = -s;
    m[5] = 1;
    m[8] = s; m[10] = c;
    m[12] = x; m[13] = y; m[14] = z; m[15] = 1;
}
function position(body) {
    return { x: body.matrix[12], y: body.matrix[13], z: body.matrix[14] };
}

function outline(wire, body, color) {
    const m = body.matrix;
    for (const [ax, ay, az, bx, by, bz] of body.kind.segments)
    {
        wire.vertex(m[0] * ax + m[4] * ay + m[8] * az + m[12], m[1] * ax + m[5] * ay + m[9] * az + m[13], m[2] * ax + m[6] * ay + m[10] * az + m[14], color);
        wire.vertex(m[0] * bx + m[4] * by + m[8] * bz + m[12], m[1] * bx + m[5] * by + m[9] * bz + m[13], m[2] * bx + m[6] * by + m[10] * bz + m[14], color);
    }
}

// outlines, built once
function boxSegments(h) {
    const segments = [];
    for (const [u, v] of [[-h, -h], [-h, h], [h, -h], [h, h]])
    {
        segments.push([-h, u, v, h, u, v], [u, -h, v, u, h, v], [u, v, -h, u, v, h]);
    }
    return segments;
}
/** an arc in a plane: `point(angle)` gives x, y, z */
function arc(segments, from, to, point, steps = 24) {
    for (let i = 0; i < steps; i++)
    {
        const p = point(from + (to - from) * i / steps);
        const q = point(from + (to - from) * (i + 1) / steps);
        segments.push([...p, ...q]);
    }
}
function sphereSegments(r) {
    const segments = [];
    arc(segments, 0, Math.PI * 2, t => [Math.cos(t) * r, Math.sin(t) * r, 0]);
    arc(segments, 0, Math.PI * 2, t => [Math.cos(t) * r, 0, Math.sin(t) * r]);
    arc(segments, 0, Math.PI * 2, t => [0, Math.cos(t) * r, Math.sin(t) * r]);
    return segments;
}
function capsuleSegments(half, r) {
    const segments = [];
    for (const y of [-half, half]) arc(segments, 0, Math.PI * 2, t => [Math.cos(t) * r, y, Math.sin(t) * r]);
    arc(segments, 0, Math.PI, t => [Math.cos(t) * r, half + Math.sin(t) * r, 0], 12);
    arc(segments, 0, Math.PI, t => [Math.cos(t) * r, -half - Math.sin(t) * r, 0], 12);
    arc(segments, 0, Math.PI, t => [0, half + Math.sin(t) * r, Math.cos(t) * r], 12);
    arc(segments, 0, Math.PI, t => [0, -half - Math.sin(t) * r, Math.cos(t) * r], 12);
    for (const [x, z] of [[r, 0], [-r, 0], [0, r], [0, -r]]) segments.push([x, -half, z, x, half, z]);
    return segments;
}
/** every pair that isn't opposite, right for an octahedron */
function hullSegments(points) {
    const segments = [];
    for (let i = 0; i < points.length; i++)
    {
        for (let j = i + 1; j < points.length; j++)
        {
            const p = points[i], q = points[j];
            if (p.x === -q.x && p.y === -q.y && p.z === -q.z) continue;
            segments.push([p.x, p.y, p.z, q.x, q.y, q.z]);
        }
    }
    return segments;
}
