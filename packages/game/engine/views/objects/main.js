import { GameEngine, GameObject } from '@papit/game-engine';

class Body extends GameObject {
    constructor(radius, color, speed, distance = 0) {
        super();
        this.radius = radius;
        this.color = color;
        this.speed = speed;
        this.position.x = distance;
    }

    update(dt) {
        this.rotation.z += this.speed * dt;
    }

    render({ ctx }) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Sun extends Body {
    update(dt) {
        super.update(dt);
        this.position.x = this.engine.width / 2;
        this.position.y = this.engine.height / 2;
    }
}

const engine = new GameEngine("canvas");
window.engine = engine;

const sun = engine.add(new Sun(50, "oklch(80% 0.17 80)", .4));
const earth = sun.add(new Body(22, "oklch(65% 0.15 240)", 2, 220));
earth.add(new Body(9, "oklch(70% 0 0)", 0, 60));
sun.add(new Body(14, "oklch(60% 0.18 30)", 1, 340));

engine.start();
