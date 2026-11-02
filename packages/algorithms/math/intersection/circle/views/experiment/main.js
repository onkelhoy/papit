// core
import { GameEngine, InputEvents } from '@papit/game-engine';
import { Circle } from "@papit/game-shape";
import { Vector2 } from "@papit/vector";

// component
import { isPointInCircle, CircleIntersection } from '@papit/circle-intersection';

const MIN_RADIUS = 5;
const FILL = "rgba(128, 128, 128, 0.2)";

let events, engine;
let selected = null;
let creating = null;
const circles = [];

window.onload = () => {
    engine = new GameEngine({ query: "canvas", theme: true });
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });

    events.on("mouse-up", handlemouseup);
    events.on("mouse-down", handlemousedown);
    events.on("mouse-move", handlemousemove);

    engine.loop(draw);
}

/** The top circle under a point, it's the one drawn last. */
function circleAt(point) {
    return circles.findLast(circle => isPointInCircle(point, circle));
}

function drawOverlap(c1, c2, { va, vb, vc }) {
    Circle.toCircle(va, 10).draw(engine.ctx, "red");
    Circle.toCircle(vb, 10).draw(engine.ctx, "red");
    Circle.toCircle(vc, 10).draw(engine.ctx, "red");

    engine.ctx.beginPath();
    engine.ctx.moveTo(va.x, va.y);
    engine.ctx.arc(c1.x, c1.y, c1.r, Math.atan2(va.y - c1.y, va.x - c1.x), Math.atan2(vb.y - c1.y, vb.x - c1.x));
    engine.ctx.lineTo(vb.x, vb.y);
    engine.ctx.arc(c2.x, c2.y, c2.r, Math.atan2(vb.y - c2.y, vb.x - c2.x), Math.atan2(va.y - c2.y, va.x - c2.x));
    engine.ctx.closePath();
    engine.ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
    engine.ctx.fill();
}

function draw() {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);

    const collisions = new Set();
    const overlaps = [];
    for (let i = 0; i < circles.length; i++)
    {
        for (let j = i + 1; j < circles.length; j++)
        {
            const intersect = CircleIntersection(circles[i], circles[j]);
            if (intersect)
            {
                collisions.add(circles[i]);
                collisions.add(circles[j]);
                overlaps.push([circles[i], circles[j], intersect]);
            }
        }
    }

    const hovered = selected?.circle ?? (creating ? null : circleAt(events.position));
    for (const circle of circles)
    {
        circle.draw(engine.ctx, circle === hovered ? "cornflowerblue" : engine.foreground, collisions.has(circle) ? "rgba(0, 255, 0, 0.3)" : FILL);
    }
    overlaps.forEach(overlap => drawOverlap(...overlap));

    if (creating)
    {
        creating.draw(engine.ctx, "orange", "rgba(255,165,0,0.1)");
    }
}

// event handlers
function handlemousemove(e) {
    if (selected)
    {
        selected.circle.set(Vector2.subtract(e.target.position, selected.offset));
    }
    else if (creating)
    {
        creating.r = Vector2.distance(creating, e.target.position);
    }
}
function handlemousedown(e) {
    const circle = circleAt(e.target.position);
    if (circle)
    {
        selected = {
            circle,
            offset: Vector2.subtract(e.target.position, circle),
        }
    }
    else
    {
        creating = Circle.toCircle(e.target.position, 0);
    }
}
function handlemouseup(e) {
    if (creating && creating.r >= MIN_RADIUS) circles.push(creating);

    creating = null;
    selected = null;
}
