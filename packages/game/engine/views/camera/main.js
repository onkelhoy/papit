import { Camera, GameEngine, GameObject, follow, pan, zoom } from '@papit/game-engine';

const WORLD = { x: 0, y: 0, width: 3000, height: 2000 };
const SPEED = 600;

class Map extends GameObject {
    render({ ctx }) {
        for (let x = 0; x < WORLD.width; x += 200)
        {
            for (let y = 0; y < WORLD.height; y += 200)
            {
                ctx.fillStyle = (x + y) % 400 ? "oklch(80% 0.05 240)" : "oklch(90% 0.05 240)";
                ctx.fillRect(x, y, 200, 200);
            }
        }
    }
}

class Player extends GameObject {
    update(dt) {
        const { keyboard } = this.engine.input;
        const pressed = name => keyboard.key(name)?.pressed ? 1 : 0;

        this.position.x += (pressed("arrowright") - pressed("arrowleft")) * SPEED * dt;
        this.position.y += (pressed("arrowdown") - pressed("arrowup")) * SPEED * dt;
    }

    render({ ctx }) {
        ctx.fillStyle = "oklch(60% 0.2 30)";
        ctx.fillRect(-20, -20, 40, 40);
    }
}

const engine = new GameEngine("canvas");
window.engine = engine;

engine.add(new Map());
const player = engine.add(new Player());
player.position.set([1500, 1000]);

const camera = new Camera({
    bounds: WORLD,
    controllers: [follow(player, { ease: .08, deadzone: { x: 60, y: 40 } }), zoom({ ease: .2 }), pan()],
});
engine.defaultLayer.camera = camera;
window.camera = camera;

// arrows move, the wheel zooms, dragging pans, space shakes
document.addEventListener("keydown", event => {
    if (event.key === " ") camera.shake();
});

engine.start();
