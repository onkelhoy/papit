// component
import { CircleOverlap, isPointInCircle, rayCircle } from '@papit/circle-intersection';

// view
import { createScene, BLUE, GREY, GREEN, RED, YELLOW } from './wire.js';

const RAY_LENGTH = 8;

const a = { x: 0, y: 1, z: 0, r: .9 };
const b = { x: 0, y: 1, z: 0, r: .6 };
const point = { x: 0, y: 0, z: 0 };
const origin = { x: -3, y: 1, z: 2.5 };
const direction = { x: 0, y: 0, z: 0 };

const form = document.querySelector("form");
let time = 0;

await createScene((wire, dt) => {
    if (!form.pause.checked) time += dt;

    // b slides through a, the point circles around it, the ray sweeps across
    b.x = Math.sin(time * .6) * 2.4;
    b.y = 1 + Math.sin(time * .9) * .4;
    b.z = Math.cos(time * .4) * .6;
    point.x = Math.cos(time * 1.3) * 1;
    point.y = 1 + Math.sin(time * 2) * .3;
    point.z = Math.sin(time * 1.3) * 1;
    const angle = Math.sin(time * .5) * .6 - .7;
    direction.x = Math.cos(angle);
    direction.y = Math.sin(time * .7) * .1;
    direction.z = Math.sin(angle);

    const overlap = CircleOverlap(a, b);
    const color = overlap ? GREEN : GREY;
    wire.sphere(a.x, a.y, a.z, a.r, color);
    wire.sphere(b.x, b.y, b.z, b.r, color);
    if (overlap) wire.arrow(b, overlap.normal, overlap.depth, RED);

    wire.point(point, isPointInCircle(point, a) ? YELLOW : GREY, .1);

    const hit = rayCircle(origin, direction, a);
    wire.point(origin, BLUE);
    if (hit)
    {
        wire.line(origin, hit.point, BLUE);
        wire.arrow(hit.point, hit.normal, .5, RED);
        return;
    }
    wire.arrow(origin, direction, RAY_LENGTH, GREY);
});
