import { GameEngine } from "@papit/game-engine";
import { Armature } from "@papit/armature";

import { Rig } from "../shared/rig.js";

const limits = document.querySelector("[name=limits]");
const bend = document.querySelector("[name=bend]");

const engine = new GameEngine({ query: "canvas", theme: true });
const canvas = engine.defaultLayer.element;
const pointer = [engine.width * .75, engine.height * .35];

const knee = { hinge: [0, 0, 1], min: 0, max: 2.6 };
const joint = { hinge: [0, 0, 1], min: -.5, max: .5 };

const leg = new Armature();
const thigh = leg.add("thigh", { length: 130, angle: 1.2, offset: [engine.width * .25, engine.height * .25] });
const shin = leg.add("shin", { length: 130, parent: thigh, angle: .6, limit: knee });
const reach = [0, 0];
leg.ik(shin, { chain: 2, target: reach, pole: [engine.width, 0] });

const tail = new Armature();
let last = tail.add("0", { length: 40, angle: -Math.PI / 2, offset: [engine.width * .65, engine.height - 40] });
for (let i = 1; i < 10; i++) last = tail.add(`${i}`, { length: 40, parent: last, angle: .05, limit: joint });
tail.ik(last, { target: pointer, iterations: 20 });

class Limited extends Rig {
    update() {
        joint.min = -bend.value;
        joint.max = +bend.value;

        shin.limit = limits.checked ? knee : null;
        for (const bone of tail.bones.slice(1)) bone.limit = limits.checked ? joint : null;

        reach[0] = pointer[0] - engine.width / 2;
        reach[1] = pointer[1];

        this.armature.update();
    }
}

engine.add(new Limited(leg));
engine.add(new Limited(tail));

canvas.addEventListener("pointermove", event => {
    const box = canvas.getBoundingClientRect();
    pointer[0] = (event.clientX - box.left) * canvas.width / box.width;
    pointer[1] = (event.clientY - box.top) * canvas.height / box.height;
});

engine.start();
