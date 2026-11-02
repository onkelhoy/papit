// core
import { GameEngine, InputEvents } from '@papit/game-engine';
import { SAT } from '@papit/sat';
import { Vector2 } from "@papit/vector";

// component
import { isPointInTriangle } from '@papit/triangle-intersection';

const MIN_RADIUS = 5;
const FILL = "rgba(128, 128, 128, 0.2)";

let engine, events;
let selected = null;
let creating = null;
const triangles = [];

window.onload = () => {
    engine = new GameEngine({ query: "canvas", theme: true });
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });

    events.on("mouse-up", handlemouseup);
    events.on("mouse-down", handlemousedown);
    events.on("mouse-move", handlemousemove);

    engine.loop(draw);
}

/** The top triangle under a point, it's the one drawn last. */
function triangleAt(point) {
    return triangles.findLast(triangle => isPointInTriangle(point, ...triangle.vertices));
}

/** An equilateral triangle around `center` with its first vertex on `tip`. */
function pointingTriangle(center, tip) {
    const radius = Vector2.distance(center, tip);
    const angle = Math.atan2(tip.y - center.y, tip.x - center.x);
    const vertices = [0, 1, 2].map(i => {
        const vertexangle = angle + i * Math.PI * 2 / 3;
        return new Vector2(center.x + Math.cos(vertexangle) * radius, center.y + Math.sin(vertexangle) * radius);
    });

    return { vertices, radius };
}

function drawTriangle({ vertices }, strokecolor, fillcolor) {
    const { ctx } = engine;
    ctx.beginPath();
    vertices.forEach(vertex => ctx.lineTo(vertex.x, vertex.y));
    ctx.closePath();
    ctx.strokeStyle = strokecolor;
    ctx.fillStyle = fillcolor;
    ctx.fill();
    ctx.stroke();

    // the first vertex is the one that points
    ctx.beginPath();
    ctx.arc(vertices[0].x, vertices[0].y, 4, 0, Math.PI * 2);
    ctx.fillStyle = strokecolor;
    ctx.fill();
}

function draw() {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);

    const collisions = new Set();
    for (let i = 0; i < triangles.length; i++)
    {
        for (let j = i + 1; j < triangles.length; j++)
        {
            if (SAT(triangles[i], triangles[j]))
            {
                collisions.add(triangles[i]);
                collisions.add(triangles[j]);
            }
        }
    }

    const hovered = selected?.triangle ?? (creating ? null : triangleAt(events.position));
    for (const triangle of triangles)
    {
        const strokecolor = triangle === hovered ? "cornflowerblue" : engine.foreground;
        drawTriangle(triangle, strokecolor, collisions.has(triangle) ? "rgba(0, 255, 0, 0.5)" : FILL);
    }

    if (creating)
    {
        drawTriangle(pointingTriangle(creating.center, events.position), "orange", "rgba(255, 165, 0, 0.1)");
    }
}

// event handlers
function handlemousemove(e) {
    if (!selected) return;

    const position = e.target.position;
    const movement = Vector2.subtract(position, selected.mouse);
    selected.triangle.vertices.forEach(vertex => vertex.add(movement));
    selected.mouse = position.clone;
}
function handlemousedown(e) {
    const position = e.target.position;
    const triangle = triangleAt(position);

    if (triangle) selected = { triangle, mouse: position.clone };
    else creating = { center: position.clone };
}
function handlemouseup(e) {
    if (creating)
    {
        const triangle = pointingTriangle(creating.center, e.target.position);
        if (triangle.radius >= MIN_RADIUS) triangles.push(triangle);
    }

    creating = null;
    selected = null;
}
