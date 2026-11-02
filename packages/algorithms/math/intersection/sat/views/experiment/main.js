// core
import { GameEngine, InputEvents } from '@papit/game-engine';
import { DrawPolygon } from "@papit/game-shape";
import { Polygon } from "@papit/polygon";
import { isPointInPolygonTriangles } from '@papit/polygon-intersection';
import { Vector2 } from "@papit/vector";

// component
import { SAT } from '@papit/sat';

const FILL = "rgba(128, 128, 128, 0.2)";

let engine, events;
let selected = null;
let creating = null;
const polygons = [];

window.onload = () => {
    engine = new GameEngine({ query: "canvas", theme: true });
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });

    events.on("mouse-up", handlemouseup);
    events.on("mouse-down", handlemousedown);
    events.on("mouse-move", handlemousemove);

    engine.loop(draw);
}

function draw() {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);

    const collisions = new Set();
    for (let i = 0; i < polygons.length; i++)
    {
        for (let j = i + 1; j < polygons.length; j++)
        {
            if (SAT(polygons[i], polygons[j]))
            {
                collisions.add(i);
                collisions.add(j);
            }
        }
    }

    polygons.forEach((polygon, i) => {
        if (selected?.polygon === polygon)
        {
            DrawPolygon(polygon, engine.ctx, { strokecolor: "cornflowerblue", fillcolor: "rgba(100, 149, 237, 0.2)" });
        }
        else if (collisions.has(i))
        {
            DrawPolygon(polygon, engine.ctx, { strokecolor: "green", fillcolor: "rgba(0, 255, 0, 0.1)" });
        }
        else
        {
            DrawPolygon(polygon, engine.ctx, { strokecolor: engine.foreground, fillcolor: FILL });
        }
    });

    if (creating)
    {
        engine.ctx.strokeStyle = "cornflowerblue";
        engine.ctx.beginPath();
        creating.forEach(vertex => engine.ctx.lineTo(vertex.x, vertex.y));
        engine.ctx.stroke();
    }
}

function finish() {
    polygons.push(new Polygon(...creating));
    creating = null;
}

// event handlers
function handlemousemove(e) {
    if (selected)
    {
        selected.polygon.move(Vector2.subtract(e.target.position, selected.mouse));
        selected.mouse = e.target.position.clone;
    }
}
function handlemousedown(e) {
    if (creating) return;

    for (const polygon of polygons)
    {
        if (isPointInPolygonTriangles(e.target.position, polygon))
        {
            selected = { polygon, mouse: e.target.position.clone };
            return;
        }
    }

    creating = [];
}
function handlemouseup(e) {
    if (selected)
    {
        selected = null;
        return;
    }

    // clicking the first vertex closes the polygon
    if (creating.length > 2 && Vector2.distance(e.target.position, creating[0]) <= 20)
    {
        finish();
        return;
    }

    creating.push(e.target.position.clone);
}
