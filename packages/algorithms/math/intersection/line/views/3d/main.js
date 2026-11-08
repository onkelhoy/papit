// component
import { closestPointOnSegment, closestSegmentPoints, rayPlane } from '@papit/line-intersection';

// view
import { createScene, BLUE, GREY, GREEN, RED, YELLOW } from './wire.js';

const PLANE_SIZE = 1.5;

const s1 = { p: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0 } };
const s2 = { p: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0 } };
const point = { x: 0, y: 0, z: 0 };

// a tilted plane off to the side, and a ray from above that sweeps over it
const normal = normalize({ x: -.3, y: 1, z: .25 });
const center = { x: -2.5, y: .5, z: -1 };
const plane = { normal, point: center };
const origin = { x: -2.5, y: 3, z: -1 };
const direction = { x: 0, y: -1, z: 0 };
const [u, v] = tangents(normal);

const form = document.querySelector("form");
let time = 0;

await createScene((wire, dt) => {
    if (!form.pause.checked) time += dt;

    // two segments spinning past each other
    spin(s1, 0, 1.2, 0, time * .5, 1.4);
    spin(s2, Math.sin(time * .4) * .8, 1, .4, -time * .8 + 1, 1);
    point.x = Math.cos(time) * 1.5;
    point.y = 1.6;
    point.z = Math.sin(time) * 1.5;

    wire.line(s1.p, s1.q, GREEN);
    wire.line(s2.p, s2.q, GREEN);
    const closest = closestSegmentPoints(s1.p, s1.q, s2.p, s2.q);
    wire.line(closest.a, closest.b, YELLOW);
    wire.point(closest.a, YELLOW);
    wire.point(closest.b, YELLOW);

    const onSegment = closestPointOnSegment(point, s1.p, s1.q);
    wire.point(point, BLUE, .1);
    wire.line(point, onSegment.point, BLUE);

    drawPlane(wire);
    direction.x = Math.sin(time * .7) * .4;
    direction.y = -1;
    direction.z = Math.cos(time * .5) * .4;
    const hit = rayPlane(origin, direction, plane);
    wire.point(origin, RED);
    if (hit)
    {
        wire.line(origin, hit.point, RED);
        wire.point(hit.point, RED, .1);
        return;
    }
    wire.arrow(origin, direction, 4, GREY);
});

/** a segment of `length` through x, y, z, turned by `angle` about y and tipped a little */
function spin(segment, x, y, z, angle, length) {
    const c = Math.cos(angle) * length / 2, s = Math.sin(angle) * length / 2;
    const tip = Math.sin(angle * .7) * length / 4;
    segment.p.x = x - c; segment.p.y = y - tip; segment.p.z = z - s;
    segment.q.x = x + c; segment.q.y = y + tip; segment.q.z = z + s;
}

function drawPlane(wire) {
    const at = (a, b) => ({
        x: center.x + u.x * a + v.x * b,
        y: center.y + u.y * a + v.y * b,
        z: center.z + u.z * a + v.z * b,
    });
    for (let i = -2; i <= 2; i++)
    {
        const k = i / 2 * PLANE_SIZE;
        wire.line(at(k, -PLANE_SIZE), at(k, PLANE_SIZE), GREY);
        wire.line(at(-PLANE_SIZE, k), at(PLANE_SIZE, k), GREY);
    }
    wire.arrow(center, normal, .6, GREEN);
}

function normalize(p) {
    const length = Math.hypot(p.x, p.y, p.z);
    return { x: p.x / length, y: p.y / length, z: p.z / length };
}
function cross(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
/** two unit vectors lying in the plane */
function tangents(n) {
    const first = normalize(cross(n, Math.abs(n.x) < .9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }));
    return [first, cross(n, first)];
}
