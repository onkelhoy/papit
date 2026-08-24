// core
import { Engine, InputEvents } from '@papit/game-engine';

// component
import { Spritesheet } from '@papit/2d-spritesheet';

let engine, events;
let spritesheet;

const alphabet = new Map(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖabcdefghijklmnopqrstuvwxyzåäö"
        .split("")
        .map((key, index) => [key, index])
);

window.onload = () => {
    engine = new Engine("canvas");
    events = new InputEvents(engine.canvas, { mouse: { pointerlock: false } });
    engine.resizeCanvasToDisplaySize();
    engine.ctx.imageSmoothingEnabled = false;
    engine.ctx.imageSmoothingQuality = 'pixelated';
    spritesheet = new Spritesheet("/alphabet.png", 8, 8);
    events.on("key-up", handlekeyup);

    // engine.loop(draw); // cool function
}

function draw(index) {
    engine.ctx.clearRect(0, 0, engine.width, engine.height);
    spritesheet.draw(engine.ctx, index, {
        x: engine.width / 2 - 100,
        y: engine.height / 2 - 100,
        width: 200,
        height: 200,
    });
}

// event handlers
function handlekeyup(e) {
    // mouse up 
    const index = alphabet.get(e.detail.key)
    if (index === undefined) return;

    draw(index);
    console.log({ [e.detail.key]: index });
}