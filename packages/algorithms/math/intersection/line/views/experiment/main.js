// core
import { GameEngine, InputEvents } from '@papit/game-engine';
import { Line, Circle } from "@papit/game-shape";

// component
import { isPointInCircle } from '@papit/circle-intersection';
import { LineIntersection, SegmentIntersection } from '@papit/line-intersection';
import { Vector2 } from '@papit/vector';

let engine, events;
let selected = null;
let creating = null;
const lines = [];
let method = "segment";

window.onload = () => {
    engine = new GameEngine({ query: "canvas", theme: true });
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });

    events.on("mouse-up", handlemouseup);
    events.on("mouse-down", handlemousedown);
    events.on("mouse-move", handlemousemove);

    document.querySelector('select').addEventListener('change', handleselectchange);
}

function draw() {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);
    const checked = {};
    for (let i = 0; i < lines.length; i++)
    {
        const line = lines[i];
        if (selected && selected.line === line)
        {
            line.draw(engine.ctx, "cornflowerblue", 2);
        }
        else
        {
            line.draw(engine.ctx, engine.foreground);
        }

        for (let j = 0; j < lines.length; j++)
        {
            if (i === j) continue;
            const key = `${i}x${j}`
            if (checked[key]) continue;

            // mark this and its opposite
            checked[key] = true;
            checked[`${j}x${i}`] = true;

            let intersect;
            if (method === "segment")
            {
                intersect = SegmentIntersection(line.a, line.b, lines[j].a, lines[j].b);
            }
            else // line
            {
                intersect = LineIntersection(line.a, line.b, lines[j].a, lines[j].b);
            }
            if (intersect)
            {
                const c = Circle.toCircle(intersect, 15);
                c.draw(engine.ctx, "red");
            }
        }

    }

    if (creating)
    {
        creating.draw(engine.ctx, "orange", 2);
    }
}

// event handlers
function handleselectchange(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();

    const { value } = e.target;
    method = value;
    engine.loop(draw);
    engine.stop();
}
function handlemousemove(e) {
    if (selected)
    {
        selected.point.set(Vector2.subtract(e.target.position, selected.offset));
    }
    else if (creating)
    {
        creating.b.set(e.target.position);
    }
}
function handlemousedown(e) {
    // check if selection is free 
    for (const line of lines)
    {
        if (isPointInCircle(e.target.position, Circle.toCircle(line.a, 10)))
        {
            selected = {
                point: line.a,
                line,
                offset: Vector2.subtract(e.target.position, line.a),
            }
        }
        else if (isPointInCircle(e.target.position, Circle.toCircle(line.b, 10)))
        {
            selected = {
                point: line.b,
                line,
                offset: Vector2.subtract(e.target.position, line.b),
            }
        }
    }

    if (!selected)
    {

        creating = new Line(
            new Vector2(e.target.position),
            new Vector2(e.target.position),
        );
    }

    engine.loop(draw);
}
function handlemouseup(e) {
    if (creating)
    {
        lines.push(creating);
        creating = null;
    }
    else if (selected)
    {
        selected = null;
    }

    setTimeout(() => engine.stop(), 100);
}