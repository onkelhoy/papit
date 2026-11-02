import { GameEngine } from "@papit/game-engine";
import { Armature } from "@papit/armature";

import { Rig } from "../shared/rig.js";

const engine = new GameEngine({ query: "canvas", theme: true });
const canvas = engine.defaultLayer.element;
const pointer = [engine.width / 2, engine.height / 2];

const rig = new Armature();
let last = rig.add("0", { length: 24, offset: [80, engine.height / 2] });
for (let i = 1; i < 24; i++) last = rig.add(`${i}`, { length: 24, parent: last });

const head = [80 + 24 * 24, engine.height / 2];
const body = rig.ik(last, { free: true, target: head });

class Snake extends Rig {
    update(dt) {
        // ease the head towards the pointer, the body trails on its own
        const tip = body.tip;
        const pull = Math.min(1, dt * 6);
        head[0] = tip.x + (pointer[0] - tip.x) * pull;
        head[1] = tip.y + (pointer[1] - tip.y) * pull;

        rig.update();
    }
}

engine.add(new Snake(rig));

canvas.addEventListener("pointermove", event => {
    const box = canvas.getBoundingClientRect();
    pointer[0] = (event.clientX - box.left) * canvas.width / box.width;
    pointer[1] = (event.clientY - box.top) * canvas.height / box.height;
});

engine.start();
