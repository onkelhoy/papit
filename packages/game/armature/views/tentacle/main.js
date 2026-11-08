import { GameEngine } from "@papit/game-engine";
import { Armature } from "@papit/armature";

import { Rig } from "../shared/rig.js";

const REACH = 420;

const engine = new GameEngine({ query: "canvas", theme: true });
const canvas = engine.defaultLayer.element;
const count = document.querySelector("[name=bones]");
const pointer = [engine.width / 2 + 180, engine.height - 180];

function build(bones) {
    const rig = new Armature();
    const size = REACH / bones;
    let last = rig.add("0", { length: size, angle: -Math.PI / 2, offset: [engine.width / 2, engine.height - 40] });

    for (let i = 1; i < bones; i++) last = rig.add(`${i}`, { length: size, parent: last, angle: .1 });

    rig.ik(last, { target: pointer, iterations: 20 });
    return rig;
}

class Tentacle extends Rig {
    constructor() {
        super(new Armature());
        this.rebuild();
    }

    rebuild() {
        this.armature = build(+count.value);
    }

    update() {
        this.armature.update();
    }
}

const tentacle = engine.add(new Tentacle());

count.addEventListener("input", () => tentacle.rebuild());
canvas.addEventListener("pointermove", event => {
    const box = canvas.getBoundingClientRect();
    pointer[0] = (event.clientX - box.left) * canvas.width / box.width;
    pointer[1] = (event.clientY - box.top) * canvas.height / box.height;
});

engine.start();
