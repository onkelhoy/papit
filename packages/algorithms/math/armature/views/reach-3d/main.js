import { Armature } from "@papit/armature";

import { GREEN, GROUND, ORANGE, Rig3D, stage } from "../shared/stage-3d.js";

const { engine, draw, marker } = await stage();

const rig = new Armature();

const upper = rig.add("upper", { length: 1.6, offset: [-1.5, 0, 0] });
const lower = rig.add("lower", { length: 1.4, parent: upper });
rig.add("hand", { length: .4, parent: lower });

let last = rig.add("chain 0", { length: .4, offset: [1.5, 0, 0], angle: Math.PI / 2 });
const first = last;
for (let i = 1; i < 8; i++) last = rig.add(`chain ${i}`, { length: .4, parent: last, angle: .1 });

const target = [0, 0, 0];
rig.ik(lower, { chain: 2, target, pole: [-1.5, -3, -1] });
rig.ik(last, { chain: 8, target });

class Reach extends Rig3D {
    update() {
        const time = this.engine.time;
        target[0] = Math.sin(time * .9) * 1.2;
        target[1] = 1.2 + Math.sin(time * 1.3) * .9;
        target[2] = Math.cos(time * .7) * 1.4;

        rig.update();
    }

    render() {
        super.render();
        marker(target, .24, GREEN);
        marker(upper.head, .3, ORANGE);
        marker(first.head, .3, ORANGE);
        draw(ground, 12, 12, GROUND);
    }
}

const ground = new Float32Array([1, 0, 0, 0, 0, .01, 0, 0, 0, 0, 1, 0, -6, -.3, 0, 1]);

engine.add(new Reach(rig, draw));
engine.start();
