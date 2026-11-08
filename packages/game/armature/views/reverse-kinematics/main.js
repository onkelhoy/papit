import { GameEngine } from "@papit/game-engine";
import { Armature } from "@papit/armature";

import { HANDLE, Handle, JOINT, Rig, draggable } from "../shared/rig.js";

const weight = document.querySelector("[name=weight]");

const engine = new GameEngine({ query: "canvas", theme: true });
const hipHandle = new Handle(engine.width / 2, engine.height / 2 - 120, "#6e8fd8");
const footHandle = new Handle(engine.width / 2 + 60, engine.height / 2 + 110, HANDLE);
const poleHandle = new Handle(engine.width / 2 + 260, engine.height / 2, JOINT);

// handles are in canvas pixels and the rig is in object space, so the object sits at 0, 0
const rig = new Armature();
const hips = rig.add("hips", { offset: [hipHandle.position.x, hipHandle.position.y] });
const thigh = rig.add("thigh", { length: 150, parent: hips, angle: 1 });
const shin = rig.add("shin", { length: 150, parent: thigh, angle: .5 });
rig.add("foot", { length: 40, parent: shin, angle: -1.2 });

// the pole is a bone on the hips, so it comes along when the hips move
const pole = rig.add("pole", { parent: hips, offset: [260, 120] });

const target = [0, 0];
const knee = rig.ik(shin, { chain: 2, target, pole });

class Leg extends Rig {
    update() {
        hips.offset.x = hipHandle.position.x;
        hips.offset.y = hipHandle.position.y;
        target[0] = footHandle.position.x;
        target[1] = footHandle.position.y;
        knee.weight = +weight.value;

        if (drag.held() === poleHandle) pole.moveTo([poleHandle.position.x, poleHandle.position.y]);

        rig.update();

        poleHandle.position.x = pole.head.x;
        poleHandle.position.y = pole.head.y;
    }
}

engine.add(new Leg(rig));
engine.add(footHandle);
engine.add(hipHandle);
engine.add(poleHandle);
const drag = draggable(engine.defaultLayer.element, [hipHandle, footHandle, poleHandle]);
engine.start();
