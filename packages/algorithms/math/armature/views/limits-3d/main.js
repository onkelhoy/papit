import { Armature } from "@papit/armature";

import { GREEN, ORANGE, Rig3D, stage } from "../shared/stage-3d.js";

const limits = document.querySelector("[name=limits]");
const cone = document.querySelector("[name=cone]");

const { engine, draw, marker } = await stage({ distance: 7 });

const limit = { cone: .4 };
const rig = new Armature();

let last = rig.add("0", { length: .5, offset: [0, -2, 0], angle: Math.PI / 2 });
const first = last;
for (let i = 1; i < 8; i++) last = rig.add(`${i}`, { length: .5, parent: last, angle: .05, limit });

const target = [0, 0, 0];
rig.ik(last, { target, iterations: 20 });

class Limited extends Rig3D {
    update() {
        const time = this.engine.time;
        target[0] = Math.sin(time * .8) * 2;
        target[1] = Math.cos(time * 1.1) * .4;
        target[2] = Math.cos(time * .6) * 2;

        limit.cone = +cone.value;
        for (const bone of rig.bones.slice(1)) bone.limit = limits.checked ? limit : null;

        rig.update();
    }

    render() {
        super.render();
        marker(target, .24, GREEN);
        marker(first.head, .3, ORANGE);
    }
}

engine.add(new Limited(rig, draw));
engine.start();
