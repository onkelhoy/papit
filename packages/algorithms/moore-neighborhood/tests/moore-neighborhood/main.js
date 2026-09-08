// core
import { Engine } from '@papit/game-engine';
import { DrawPolygon } from "@papit/game-shape";

// component
import { MooreNeighborhood } from '@papit/moore-neighborhood';

let engine;

window.onload = () => {
    engine = new Engine("canvas");


    check("case.small-1.png");
}

async function check(imageSrc) {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);

    const polygons = await MooreNeighborhood(imageSrc, 10);
    for (const p of polygons)
    {
        console.log(p)
        DrawPolygon(p, engine.ctx);
    }
}
