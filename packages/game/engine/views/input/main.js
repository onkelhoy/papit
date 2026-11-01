import { GameEngine, GameObject } from '@papit/game-engine';

const SPEED = 500;

// drag it with the mouse or a finger, or move it with WASD or the arrow keys
class Ball extends GameObject {
    radius = 40 * devicePixelRatio;
    dragged = false;

    start() {
        this.position.set([this.engine.width / 2, this.engine.height / 2, 0]);

        const { input } = this.engine;
        input.on("mouse-down", () => this.dragged = this.distance(this.pointer) <= this.radius);
        input.on("mouse-up", () => this.dragged = false);
    }

    get pointer() {
        const { position } = this.engine.input;
        return { x: position.x * devicePixelRatio, y: position.y * devicePixelRatio };
    }

    distance({ x, y }) {
        return Math.hypot(x - this.position.x, y - this.position.y);
    }

    pressed(key, arrow) {
        const { keyboard } = this.engine.input;
        return keyboard.key(key)?.pressed || keyboard.key(arrow)?.pressed ? 1 : 0;
    }

    update(dt) {
        if (this.dragged)
        {
            this.position.x = this.pointer.x;
            this.position.y = this.pointer.y;
            return;
        }

        this.position.x += (this.pressed("d", "arrowright") - this.pressed("a", "arrowleft")) * SPEED * dt;
        this.position.y += (this.pressed("s", "arrowdown") - this.pressed("w", "arrowup")) * SPEED * dt;
    }

    render({ ctx }) {
        ctx.fillStyle = this.dragged ? "oklch(60% 0.2 30)" : "oklch(80% 0.17 80)";
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Readout extends GameObject {
    pointer = document.querySelector("#pointer");
    pressing = document.querySelector("#pressing");
    keys = document.querySelector("#keys");
    touches = document.querySelector("#touches");

    update() {
        const { input } = this.engine;
        const held = Object.keys(input.keyboard.keys).filter(key => input.keyboard.keys[key].pressed);

        this.pointer.textContent = `${Math.round(input.position.x)}, ${Math.round(input.position.y)}`;
        this.pressing.textContent = input.pressing ? "yes" : "no";
        this.keys.textContent = held.join(", ") || "none";
        this.touches.textContent = String(Object.keys(input.touch.touches).length);
    }
}

const engine = new GameEngine("canvas");
window.engine = engine;

engine.add(new Ball());
engine.add(new Readout());
engine.start();
