// core
import { GameEngine } from '@papit/game-engine';

// component
import 'VARIABLE_FULL_NAME';

let engine;

window.onload = () => {
    engine = new GameEngine({ query: "canvas", theme: true });

    engine.input.on("mouse-up", handlemouseup);
    engine.input.on("mouse-down", handlemousedown);
    engine.input.on("mouse-move", handlemousemove);

    engine.loop(draw); // cool function
}

function draw() {
    const { ctx, input } = engine;
    ctx.clearRect(0, 0, engine.width, engine.height);

    // foreground follows the light and dark theme
    ctx.fillStyle = engine.foreground;
    ctx.beginPath();
    ctx.arc(input.position.x, input.position.y, 6, 0, Math.PI * 2);
    ctx.fill();
}

// event handlers
function handlemousemove(e) {
    // mouse move
}
function handlemousedown(e) {
    // mouse down 
}
function handlemouseup(e) {
    // mouse up 
}
