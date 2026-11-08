// component
import { AABB, isPointInRectangle, rayBox } from '@papit/box-intersection';

// view
import { createScene, BLUE, GREY, GREEN, RED, YELLOW } from './wire.js';

const RAY_LENGTH = 8;

const a = { x: -.75, y: .5, z: -.75, w: 1.5, h: 1, d: 1.5 };
const b = { x: 0, y: 0, z: 0, w: 1, h: 1.2, d: .8 };
const point = { x: 0, y: 0, z: 0 };
const origin = { x: -3, y: 1, z: 2.5 };
const direction = { x: 0, y: 0, z: 0 };

const form = document.querySelector("form");
let time = 0;

await createScene((wire, dt) => {
    if (!form.pause.checked) time += dt;

    // b slides through a, the point circles around it, the ray sweeps across
    b.x = Math.sin(time * .6) * 2.2 - b.w / 2;
    b.y = .3 + Math.sin(time * .9) * .3;
    b.z = Math.cos(time * .4) * .6 - b.d / 2;
    point.x = Math.cos(time * 1.3) * 1.1;
    point.y = 1 + Math.sin(time * 2) * .3;
    point.z = Math.sin(time * 1.3) * 1.1;
    const angle = Math.sin(time * .5) * .6 - .7;
    direction.x = Math.cos(angle);
    direction.y = Math.sin(time * .7) * .1;
    direction.z = Math.sin(angle);

    const overlap = AABB(a, b);
    const color = overlap ? GREEN : GREY;
    wire.box(a.x, a.y, a.z, a.w, a.h, a.d, color);
    wire.box(b.x, b.y, b.z, b.w, b.h, b.d, color);
    if (overlap) wire.box(overlap.x, overlap.y, overlap.z, overlap.w, overlap.h, overlap.d, RED);

    wire.point(point, isPointInRectangle(point, a) ? YELLOW : GREY, .1);

    const hit = rayBox(origin, direction, a);
    wire.point(origin, BLUE);
    if (hit)
    {
        wire.line(origin, hit.point, BLUE);
        wire.arrow(hit.point, hit.normal, .5, RED);
        return;
    }
    wire.arrow(origin, direction, RAY_LENGTH, GREY);
});
