// component
import { World, RigidBody, Plane, Box, Sphere, Capsule } from '@papit/rigidbody';

// view
import { createScene, GREY, GREEN, BLUE, YELLOW } from './wire.js';

const form = document.querySelector("form");
const matrix = new Float64Array(16);
let world;
/** outline segments per shape, built once */
const cache = new Map();

function reset() {
    world = new World();
    world.add(new RigidBody({ shape: new Plane() }));
    // a static ramp
    world.add(new RigidBody({ shape: new Box(4, .3, 3), position: { x: -2, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: -.2, w: .98 } }));
    drop();
}

let seed = 1;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function drop() {
    for (let i = 0; i < 10; i++)
    {
        const shape = [new Box(.6, .6, .6), new Sphere(.35), new Capsule(.25, .5)][i % 3];
        world.add(new RigidBody({
            shape,
            mass: 1,
            restitution: .3,
            position: { x: -2.5 + random() * 3, y: 4 + i * .8, z: -1 + random() * 2 },
        }));
    }
}

form.drop.addEventListener("click", drop);
form.reset.addEventListener("click", reset);
reset();

await createScene((wire, dt) => {
    if (!form.pause.checked) world.update(Math.min(dt, .1));
    wire.grid(6, GREY);

    let sleeping = 0;
    for (const body of world.bodies)
    {
        if (!body.shape || body.shape.kind === "plane") continue;
        if (body.sleeping) sleeping++;
        body.matrix(matrix);
        const color = body.isStatic ? GREY : body.sleeping ? BLUE : GREEN;
        outline(wire, segments(body.shape), color);
    }
    for (const contact of world.contacts)
    {
        for (let i = 0; i < contact.count; i++) wire.point(contact.points[i].a, YELLOW);
    }
    form.info.value = `${world.bodies.length - 1} bodies, ${sleeping} sleeping, ${world.contacts.length} contacts`;
}, { distance: 12, yaw: .6, pitch: .4 });

// outlines, one list of local segments per shape
function segments(shape) {
    let list = cache.get(shape);
    if (list) return list;
    list = [];
    if (shape.kind === "box")
    {
        const { x, y, z } = shape.half;
        for (const [u, v] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
        {
            list.push([-x, u * y, v * z, x, u * y, v * z], [u * x, -y, v * z, u * x, y, v * z], [u * x, v * y, -z, u * x, v * y, z]);
        }
    }
    else if (shape.kind === "sphere")
    {
        const r = shape.radius;
        arc(list, t => [Math.cos(t) * r, Math.sin(t) * r, 0]);
        arc(list, t => [Math.cos(t) * r, 0, Math.sin(t) * r]);
        arc(list, t => [0, Math.cos(t) * r, Math.sin(t) * r]);
    }
    else if (shape.kind === "capsule")
    {
        const r = shape.radius, h = shape.height / 2;
        for (const y of [-h, h]) arc(list, t => [Math.cos(t) * r, y, Math.sin(t) * r]);
        arc(list, t => [Math.cos(t) * r, (Math.sin(t) > 0 ? h : -h) + Math.sin(t) * r, 0]);
        for (const [x, z] of [[r, 0], [-r, 0], [0, r], [0, -r]]) list.push([x, -h, z, x, h, z]);
    }
    cache.set(shape, list);
    return list;
}
function arc(list, point, steps = 20) {
    for (let i = 0; i < steps; i++)
    {
        list.push([...point(Math.PI * 2 * i / steps), ...point(Math.PI * 2 * (i + 1) / steps)]);
    }
}
function outline(wire, list, color) {
    const m = matrix;
    for (const [ax, ay, az, bx, by, bz] of list)
    {
        wire.vertex(m[0] * ax + m[4] * ay + m[8] * az + m[12], m[1] * ax + m[5] * ay + m[9] * az + m[13], m[2] * ax + m[6] * ay + m[10] * az + m[14], color);
        wire.vertex(m[0] * bx + m[4] * by + m[8] * bz + m[12], m[1] * bx + m[5] * by + m[9] * bz + m[13], m[2] * bx + m[6] * by + m[10] * bz + m[14], color);
    }
}
