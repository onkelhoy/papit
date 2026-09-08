// core
import { Engine } from '@papit/game-engine';
import { DrawPolygon } from "@papit/game-shape";

// component
import { MooreNeighborhood } from '@papit/moore-neighborhood';

let engine;

window.onload = () => {
    engine = new Engine("canvas");

    // check("case.small-1.png");
    document.querySelector('select').onchange = handlechange;
    setTimeout(() => {
        handlechange("/case.big-1.png");
    }, 100)
}

async function handlechange(e) {
    const value = typeof e === "string" ? e : e.target.value;

    engine.ctx.clearRect(0, 0, engine.width, engine.height);

    const img = document.querySelector("img");
    img.src = value;

    const polygons = await MooreNeighborhood(value, /big/.test(value) ? 1 : 10);
    for (const p of polygons)
    {
        console.log(p)
        DrawPolygon(p, engine.ctx);
    }
}
