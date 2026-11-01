// core
import { GameEngine, InputEvents } from '@papit/game-engine';
import { Rectangle } from "@papit/game-shape";
import { Vector2 } from "@papit/vector";

// component
import { isPointInRectangle, AABB } from '@papit/box-intersection';

const MIN_SIZE = 5;
const FILL = "rgba(128, 128, 128, 0.2)";

let engine, events;
let selected = null;
let creating = null;
const rectangles = [];

window.onload = () => {
    engine = new GameEngine({ query: "canvas", theme: true });
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });

    events.on("mouse-up", handlemouseup);
    events.on("mouse-down", handlemousedown);
    events.on("mouse-move", handlemousemove);

    engine.loop(draw);
}

/** The top rectangle under a point, it's the one drawn last. */
function rectangleAt(point) {
    return rectangles.findLast(rec => isPointInRectangle(point, rec));
}

function draw() {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);

    const collisions = new Set();
    const overlaps = [];
    for (let i = 0; i < rectangles.length; i++)
    {
        for (let j = i + 1; j < rectangles.length; j++)
        {
            const intersectionrec = AABB(rectangles[i], rectangles[j]);
            if (intersectionrec)
            {
                collisions.add(rectangles[i]);
                collisions.add(rectangles[j]);
                overlaps.push(new Rectangle(intersectionrec.x, intersectionrec.y, intersectionrec.w, intersectionrec.h));
            }
        }
    }

    const hovered = selected?.rectangle ?? (creating ? null : rectangleAt(events.position));
    for (const rec of rectangles)
    {
        rec.draw(engine.ctx, rec === hovered ? "cornflowerblue" : engine.foreground, collisions.has(rec) ? "rgba(0, 255, 0, 0.3)" : FILL);
    }
    overlaps.forEach(rec => rec.draw(engine.ctx, "red", "rgba(0, 255, 0, 0.5)"));

    if (creating)
    {
        engine.ctx.strokeStyle = engine.foreground;
        engine.ctx.beginPath();
        engine.ctx.moveTo(creating.a.x, creating.a.y);
        engine.ctx.lineTo(creating.b.x, creating.a.y);
        engine.ctx.lineTo(creating.b.x, creating.b.y);
        engine.ctx.lineTo(creating.a.x, creating.b.y);
        engine.ctx.lineTo(creating.a.x, creating.a.y);
        engine.ctx.stroke();
        engine.ctx.closePath();
    }
}

// event handlers
function handlemousemove(e) {
    if (selected)
    {
        selected.rectangle.set(Vector2.subtract(e.target.position, selected.offset))
    }
    else if (creating)
    {
        creating.b.set(e.target.position)
    }
}
function handlemousedown(e) {
    const rectangle = rectangleAt(e.target.position);
    if (rectangle)
    {
        selected = {
            rectangle,
            offset: Vector2.subtract(e.target.position, rectangle),
        }
    }
    else
    {
        creating = {
            a: e.target.position.clone,
            b: e.target.position.clone,
        }
    }
}
function handlemouseup(e) {
    if (creating)
    {
        const w = Math.abs(creating.a.x - creating.b.x);
        const h = Math.abs(creating.a.y - creating.b.y);
        if (w >= MIN_SIZE && h >= MIN_SIZE)
        {
            rectangles.push(new Rectangle(Math.min(creating.a.x, creating.b.x), Math.min(creating.a.y, creating.b.y), w, h));
        }
    }

    creating = null;
    selected = null;
}
