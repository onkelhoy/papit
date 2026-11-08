import { Armature } from "@papit/armature";

import { GREEN, GROUND, ORANGE, Rig3D, stage } from "../shared/stage-3d.js";

const LEGS = 6;
const HEIGHT = .8;
const RADIUS = 1.5;
const STRIDE = .9;
const STEP_TIME = .18;
const STEP_HEIGHT = .35;

const speed = document.querySelector("[name=speed]");

const { engine, draw, marker } = await stage({ distance: 9, pitch: .5 });

const rig = new Armature();
const body = rig.add("body", { offset: [0, HEIGHT, 0] });

const legs = [];
for (let i = 0; i < LEGS; i++)
{
    const angle = i / LEGS * Math.PI * 2;
    const hip = [Math.cos(angle) * .45, 0, Math.sin(angle) * .45];

    const upper = rig.add(`upper ${i}`, { length: .95, parent: body, offset: hip });
    const lower = rig.add(`lower ${i}`, { length: 1.25, parent: upper });

    const foot = [hip[0] * 3, 0, hip[2] * 3];
    const pole = [0, 0, 0];
    rig.ik(lower, { chain: 2, target: foot, pole });

    legs.push({
        angle,
        foot,
        pole,
        from: [0, 0, 0],
        to: [0, 0, 0],
        step: -1,
        group: i % 2,
    });
}

let walked = 0;

class Spider extends Rig3D {
    update(dt) {
        walked += dt * .5 * +speed.value;

        const x = Math.cos(walked) * 3, z = Math.sin(walked) * 3;
        body.offset.x = x;
        body.offset.z = z;
        body.offset.y = HEIGHT + Math.sin(walked * 7) * .04;
        body.rotation.setAxisAngle(0, 1, 0, -walked);

        for (const leg of legs)
        {
            const facing = leg.angle - walked;
            const restX = x + Math.cos(facing) * RADIUS;
            const restZ = z + Math.sin(facing) * RADIUS;

            const stepping = legs.some(other => other.group === leg.group && other.step >= 0);
            const lag = Math.hypot(leg.foot[0] - restX, leg.foot[2] - restZ);

            if (leg.step < 0 && lag > STRIDE && !stepping && !legs.some(other => other.group !== leg.group && other.step >= 0))
            {
                for (const partner of legs)
                {
                    if (partner.group !== leg.group) continue;
                    partner.step = 0;
                    partner.from = [...partner.foot];
                }
            }

            if (leg.step >= 0)
            {
                leg.step += dt / STEP_TIME;
                const t = Math.min(1, leg.step);

                leg.foot[0] = leg.from[0] + (restX - leg.from[0]) * t;
                leg.foot[2] = leg.from[2] + (restZ - leg.from[2]) * t;
                leg.foot[1] = Math.sin(t * Math.PI) * STEP_HEIGHT;

                if (t === 1) leg.step = -1;
            }

            // knees point up and out
            leg.pole[0] = x + Math.cos(facing) * RADIUS * .7;
            leg.pole[1] = HEIGHT + 2;
            leg.pole[2] = z + Math.sin(facing) * RADIUS * .7;
        }

        rig.update();
    }

    render() {
        super.render();
        marker([body.head[0], body.head[1], body.head[2]], .45, ORANGE);
        for (const leg of legs) marker(leg.foot, .12, GREEN);
        draw(ground, 16, 16, GROUND);
    }
}

const ground = new Float32Array([1, 0, 0, 0, 0, .01, 0, 0, 0, 0, 1, 0, -8, -.1, 0, 1]);

engine.add(new Spider(rig, draw, .1));
engine.start();
