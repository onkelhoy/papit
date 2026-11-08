import { GameEngine } from "@papit/game-engine";
import { Armature } from "@papit/armature";

import { Rig } from "../shared/rig.js";

const rig = new Armature();
const shoulder = rig.add("shoulder", { length: 140 });
const elbow = rig.add("elbow", { length: 120, parent: shoulder });
const wrist = rig.add("wrist", { length: 50, parent: elbow });

class Arm extends Rig {
    update() {
        this.position.x = this.engine.width / 2;
        this.position.y = this.engine.height / 2;

        shoulder.angle = +controls.shoulder.value;
        elbow.angle = +controls.elbow.value;
        wrist.angle = +controls.wrist.value;
        elbow.length = +controls.length.value;
        this.scale.x = controls.mirror.checked ? -1 : 1;

        rig.update();
    }
}

const controls = Object.fromEntries(
    [...document.querySelectorAll("input")].map(input => [input.name, input])
);

const engine = new GameEngine({ query: "canvas", theme: true });
engine.add(new Arm(rig));
engine.start();
