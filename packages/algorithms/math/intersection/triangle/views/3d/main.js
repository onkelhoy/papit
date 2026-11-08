// component
import { closestPointOnTriangle, rayTriangle } from '@papit/triangle-intersection';

// view
import { createScene, BLUE, GREY, GREEN, RED } from './wire.js';

const RAY_LENGTH = 2;

// local corners, turned about y every frame
const corners = [{ x: -1.2, y: 0, z: -.4 }, { x: 1.2, y: .3, z: -.6 }, { x: .1, y: 1.6, z: .5 }];
const [a, b, c] = corners.map(() => ({ x: 0, y: 0, z: 0 }));
const point = { x: 0, y: 0, z: 0 };
const origin = { x: 0, y: 1, z: 3.5 };
const direction = { x: 0, y: 0, z: -1 };

const form = document.querySelector("form");
let time = 0;

await createScene((wire, dt) => {
    if (!form.pause.checked) time += dt;

    const angle = time * .3, cos = Math.cos(angle), sin = Math.sin(angle);
    [a, b, c].forEach((corner, i) => {
        const local = corners[i];
        corner.x = local.x * cos + local.z * sin;
        corner.y = local.y + .3;
        corner.z = -local.x * sin + local.z * cos;
    });

    point.x = Math.cos(time * .9) * 1.8;
    point.y = 1 + Math.sin(time * 1.4) * .8;
    point.z = Math.sin(time * .9) * 1.8;
    // aim at the centroid, wobbling past the edges now and then
    direction.x = (a.x + b.x + c.x) / 3 - origin.x + Math.sin(time * .6) * .45;
    direction.y = (a.y + b.y + c.y) / 3 - origin.y + Math.sin(time * .8) * .3;
    direction.z = (a.z + b.z + c.z) / 3 - origin.z;

    const hit = rayTriangle(origin, direction, a, b, c);
    const color = hit ? GREEN : GREY;
    wire.line(a, b, color);
    wire.line(b, c, color);
    wire.line(c, a, color);

    const closest = closestPointOnTriangle(point, a, b, c);
    wire.point(point, BLUE, .1);
    wire.line(point, closest.point, BLUE);
    wire.point(closest.point, BLUE);

    wire.point(origin, RED);
    if (hit)
    {
        wire.line(origin, hit.point, RED);
        wire.point(hit.point, RED, .1);
        return;
    }
    wire.arrow(origin, direction, RAY_LENGTH, GREY);
});
