// core
import { Engine, InputEvents } from '@papit/game-engine';
import { Circle } from "@papit/game-shape";
import { Vector, Vector2 } from "@papit/vector";

// component
import { isPointInCircle, CircleIntersection } from '@papit/game-intersection';

let events, engine;
let selected = null;
let creating = null;
const circles = [];

window.onload = () => {
    engine = new Engine("canvas");
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });
    engine.resizeCanvasToDisplaySize();

    events.on("mouse-up", handlemouseup);
    events.on("mouse-down", handlemousedown);
    events.on("mouse-move", handlemousemove);

    engine.loop(draw); // cool function
}


function draw() {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);
    const checked = {};
    for (let i = 0; i < circles.length; i++)
    {
        const circle = circles[i];
        if (selected && selected.circle === circle)
        {
            circle.draw(engine.ctx, "blue", "rgba(0, 0, 255, 0.1)");
        }
        else
        {
            circle.draw(engine.ctx);
        }

        for (let j = 0; j < circles.length; j++)
        {
            if (i === j) continue;
            const key = `${i}x${j}`
            if (checked[key]) continue;

            // mark this and its opposite
            checked[key] = true;
            checked[`${j}x${i}`] = true;

            const intersect = CircleIntersection(circle, circles[j]);
            if (intersect)
            {
                const { va, vb, vc } = intersect;
                const c1 = circle;
                const c2 = circles[j];
                va.draw(engine.ctx, "red", 10);
                vb.draw(engine.ctx, "red", 10);
                vc.draw(engine.ctx, "red", 10);

                engine.ctx.beginPath();
                engine.ctx.moveTo(va.x, va.y);
                engine.ctx.arc(c1.x, c1.y, c1.r, Math.atan2(va.y - c1.y, va.x - c1.x), Math.atan2(vb.y - c1.y, vb.x - c1.x));
                engine.ctx.lineTo(vb.x, vb.y);
                engine.ctx.arc(c2.x, c2.y, c2.r, Math.atan2(vb.y - c2.y, vb.x - c2.x), Math.atan2(va.y - c2.y, va.x - c2.x));
                engine.ctx.closePath();
                engine.ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
                engine.ctx.fill();

                // c.draw(engine.ctx, "red", "rgba(255,0,0,0.1)");
            }
        }
    }

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
    // check if selection is free 
    for (const circle of circles)
    {
        if (isPointInCircle(e.target.position, circle))
        {
            selected = {
                circle,
                offset: Vector2.subtract(e.target.position, circle),
            }
        }
    }

    if (!selected)
    {
        creating = Circle.toCircle(e.target.position, 0);
    }

    engine.loop(draw);
}
function handlemouseup(e) {
    if (creating)
    {
        circles.push(creating);
        creating = null;
    }
    else if (selected)
    {
        selected = null;
    }

    setTimeout(() => engine.stop(), 100);
}