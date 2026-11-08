// core
import { GameEngine, InputEvents } from '@papit/game-engine';

// component
import { gjk, distance, penetration, sphereSupport, boxSupport, hullSupport } from '@papit/gjk';

const FILL = "rgba(128, 128, 128, 0.2)";
const HIT = "rgba(0, 255, 0, 0.3)";

let engine, events;
let selected = null;
const shapes = [];

window.onload = () => {
    engine = new GameEngine({ query: "canvas", theme: true });
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });

    shapes.push(
        circle(200, 200, 60),
        box(380, 150, 140, 100),
        hull(polygonPoints(250, 400, 80, 5)),
        compound([{ x: 500, y: 350, w: 160, h: 40 }, { x: 500, y: 390, w: 40, h: 120 }]),
    );

    events.on("mouse-down", handlemousedown);
    events.on("mouse-move", handlemousemove);
    events.on("mouse-up", () => selected = null);

    engine.loop(draw);
}

// shapes: data to move and draw, plus what gjk reads
function circle(x, y, r) {
    const data = { x, y, r };
    return {
        convex: sphereSupport(data),
        points: () => [data],
        move: (dx, dy) => { data.x += dx; data.y += dy; },
        path: ctx => ctx.arc(data.x, data.y, data.r, 0, Math.PI * 2),
    };
}
function box(x, y, w, h) {
    const data = { x, y, w, h };
    return {
        convex: boxSupport(data),
        points: () => [data],
        move: (dx, dy) => { data.x += dx; data.y += dy; },
        path: ctx => ctx.rect(data.x, data.y, data.w, data.h),
    };
}
function hull(points) {
    return {
        convex: hullSupport(points),
        points: () => points,
        move: (dx, dy) => points.forEach(p => { p.x += dx; p.y += dy; }),
        path: ctx => {
            ctx.moveTo(points[0].x, points[0].y);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.closePath();
        },
    };
}
/** concave shape as convex pieces, gjk takes the array */
function compound(boxes) {
    const pieces = boxes.map(b => box(b.x, b.y, b.w, b.h));
    return {
        convex: pieces.map(p => p.convex),
        points: () => pieces.flatMap(p => p.points()),
        move: (dx, dy) => pieces.forEach(p => p.move(dx, dy)),
        path: ctx => pieces.forEach(p => p.path(ctx)),
    };
}
function polygonPoints(cx, cy, r, sides) {
    return Array.from({ length: sides }, (_, i) => {
        const angle = i * Math.PI * 2 / sides - Math.PI / 2;
        return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
}

function shapeAt(point) {
    const cursor = sphereSupport({ x: point.x, y: point.y, r: 0 });
    return shapes.findLast(shape => gjk(shape.convex, cursor));
}

function draw() {
    const { ctx } = engine;
    ctx.clearRect(0, 0, engine.width, engine.height);

    const hits = new Set();
    const results = [];
    for (let i = 0; i < shapes.length; i++)
    {
        for (let j = i + 1; j < shapes.length; j++)
        {
            const a = shapes[i], b = shapes[j];
            const hit = penetration(a.convex, b.convex);
            if (hit)
            {
                hits.add(a);
                hits.add(b);
                results.push({ hit, at: center(b) });
            }
            else
            {
                results.push({ gap: distance(a.convex, b.convex) });
            }
        }
    }

    const hovered = selected?.shape ?? shapeAt(events.position);
    for (const shape of shapes)
    {
        ctx.beginPath();
        shape.path(ctx);
        ctx.fillStyle = hits.has(shape) ? HIT : FILL;
        ctx.strokeStyle = shape === hovered ? "cornflowerblue" : engine.foreground;
        ctx.fill();
        ctx.stroke();
    }

    for (const { hit, at, gap } of results)
    {
        if (hit) arrow(ctx, at, hit.normal, hit.depth, "red");
        else if (gap) dashed(ctx, gap.pointA, gap.pointB, engine.foreground);
    }
}

function center(shape) {
    const points = shape.points();
    let x = 0, y = 0;
    for (const p of points)
    {
        x += p.x + (p.w ?? 0) / 2;
        y += p.y + (p.h ?? 0) / 2;
    }
    return { x: x / points.length, y: y / points.length };
}

/** the push-out vector: `depth` along `normal`, drawn from `from` */
function arrow(ctx, from, normal, depth, color) {
    const to = { x: from.x + normal.x * depth, y: from.y + normal.y * depth };
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(to.x, to.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(depth.toFixed(1), to.x + 6, to.y);
}

function dashed(ctx, a, b, color) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
}

// event handlers
function handlemousedown(e) {
    const shape = shapeAt(e.target.position);
    if (shape) selected = { shape, last: { x: e.target.position.x, y: e.target.position.y } };
}
function handlemousemove(e) {
    if (!selected) return;
    const { x, y } = e.target.position;
    selected.shape.move(x - selected.last.x, y - selected.last.y);
    selected.last = { x, y };
}
