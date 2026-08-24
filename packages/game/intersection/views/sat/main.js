// core
import { Engine, InputEvents } from '@papit/game-engine';
import { Polygon } from "@papit/game-shape";
import { Vector } from "@papit/vector";

// component
import { isPointInPolygonTriangles, SAT } from '@papit/game-intersection';

let engine, events;
let selected = null;
let creating = null;
const polygons = [];

window.onload = () => {
    engine = new Engine("canvas");
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });
    engine.resizeCanvasToDisplaySize();

    events.on("mouse-up", handlemouseup);
    events.on("mouse-down", handlemousedown);
    events.on("mouse-move", handlemousemove);
    // keyboard event 
    events.on('enter-up', handleenter);

    engine.loop(draw); // cool function
}

function draw() {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);

    const checked = {};
    const collisions = {};
    for (let i = 0; i < polygons.length; i++)
    {
        const polygon = polygons[i];

        for (let j = 0; j < polygons.length; j++)
        {
            if (i === j) continue;
            const key = `${i}x${j}`
            if (checked[key]) continue;

            // mark this and its opposite
            checked[key] = true;
            checked[`${j}x${i}`] = true;

            const intersection = SAT(polygon, polygons[j])
            if (intersection)
            {
                // console.log(intersection);
                // polygon.move()
                collisions[i] = true;
                collisions[j] = true;
            }
        }

        if (selected && selected.polygon === polygon)
        {
            polygon.draw(engine.ctx, "blue", "rgba(0, 0, 255, 0.1)");
        }
        else if (collisions[i])
        {
            polygon.draw(engine.ctx, "green", "rgba(0, 255, 0, 0.1)");
        }
        else
        {
            polygon.draw(engine.ctx);
        }
    }

    if (creating)
    {
        creating.draw(engine.ctx, "blue", "rgba(0, 0, 255, 0.1)");
    }
}

// event handlers
function handlemousemove(e) {
    if (selected)
    {
        const add = e.target.position.Sub(selected.mouse);
        selected.polygon.vertices.forEach((v, i) => {
            v.x = selected.original[i].x + add.x;
            v.y = selected.original[i].y + add.y;
        })
    }
    // else if (creating)
    // {
    //   creating.b.x = e.clientX;
    //   creating.b.y = e.clientY;
    // }
}
function handlemousedown(e) {
    if (!creating)
    {
        // check if selection is free 
        for (const polygon of polygons)
        {
            if (isPointInPolygonTriangles(e.target.position, polygon))
            {
                selected = {
                    polygon,
                    mouse: e.target.position.clone,
                    original: polygon.vertices.map(v => v.clone)
                }
                break;
            }
        }

        if (!selected)
        {
            creating = new Polygon();
        }
    }

    engine.loop(draw);
}
function handlemouseup(e) {
    if (creating)
    {
        if (creating.vertices.length > 1 && Vector.Distance(e.target.position, creating.vertices[0]) <= 20)
        {
            // loop it 
            creating.recalculate();
            polygons.push(creating);
            creating = null;
        }
        else
        {
            creating.vertices.push(e.target.position.clone);
        }
        // polygons.push(creating);
        // creating.recalculate();
        // creating = null;
    }
    else if (selected)
    {
        selected = null;
    }

    engine.stop();
}
function handleenter(e) {
    if (creating)
    {
        creating.recalculate();
        polygons.push(creating);
        creating = null;
        draw();
        engine.stop();
    }
}