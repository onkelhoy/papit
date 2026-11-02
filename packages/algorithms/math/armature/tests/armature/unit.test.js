import { describe, it } from "node:test";
import assert from "node:assert";

import { Armature, Bone } from "@papit/armature";

function close(actual, expected, eps = 1e-4) {
    for (let i = 0; i < expected.length; i++)
    {
        assert.ok(Math.abs(actual[i] - expected[i]) < eps, `[${[...actual]}] should be close to [${expected}]`);
    }
}

function lengthsHold(segments, eps = 1e-3) {
    for (const [head, tail, length] of segments)
    {
        const actual = Math.hypot(tail[0] - head[0], tail[1] - head[1], tail[2] - head[2]);
        assert.ok(Math.abs(actual - length) < eps, `${actual} should be close to ${length}`);
    }
}

/** Sets a constraint's options and runs it from the bones' own pose. */
function reach(ik, target, options = {}) {
    Object.assign(ik, { pole: null, weight: 1, iterations: 10 }, options, { target });
    ik.bones[0].update();
    ik.solve();
}

const turned = bone => 2 * Math.atan2(bone.solved[2], bone.solved[3]);

describe("@papit/armature", () => {
    describe("forward kinematics", () => {
        it("chains bones from tail to head", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });
            const b = rig.add("b", { length: 5, parent: a });

            close(b.head, [10, 0, 0]);
            close(b.tail, [15, 0, 0]);
        });

        it("adds parent rotations in 2D", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10, angle: Math.PI / 2 });
            const b = rig.add("b", { length: 10, parent: a, angle: Math.PI / 2 });

            close(a.tail, [0, 10, 0]);
            close(b.tail, [-10, 10, 0]);
        });

        it("rotates children around 3D axes", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });
            const b = rig.add("b", { length: 10, parent: a });

            a.rotation.setAxisAngle(0, 1, 0, Math.PI / 2);
            b.rotation.setAxisAngle(0, 0, 1, Math.PI / 2);
            rig.update();

            close(a.tail, [0, 0, -10]);
            close(b.tail, [0, 10, -10]);
        });

        it("uses attach for a point along the parent", () => {
            const rig = new Armature();
            const torso = rig.add("torso", { length: 60 });

            close(rig.add("arm", { parent: torso, attach: .8 }).head, [48, 0, 0]);
            close(rig.add("hip", { parent: torso, attach: 0 }).head, [0, 0, 0]);
        });

        it("uses offset in the parent's space", () => {
            const rig = new Armature();
            const torso = rig.add("torso", { length: 10, angle: Math.PI / 2, offset: [1, 2] });
            const arm = rig.add("arm", { parent: torso, offset: [0, 4, 0] });

            close(torso.head, [1, 2, 0]);
            close(arm.head, [-3, 12, 0]);
        });

        it("picks up a changed length", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });
            const b = rig.add("b", { length: 10, parent: a });

            a.length = 20;
            rig.update();

            close(b.tail, [30, 0, 0]);
        });

        it("keeps worldMatrix at the head with X along the bone", () => {
            const rig = new Armature();
            const m = rig.add("a", { length: 10, angle: Math.PI / 2, offset: [1, 2, 3] }).worldMatrix;

            close(m, [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
        });

        it("reads angle back and wraps it", () => {
            const rig = new Armature();
            const a = rig.add("a", { angle: 1 });
            assert.ok(Math.abs(a.angle - 1) < 1e-6);

            a.angle = 3 * Math.PI / 2;
            assert.ok(Math.abs(a.angle + Math.PI / 2) < 1e-6);
        });
    });

    describe("pointAt", () => {
        it("aims the tail at a point", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });

            a.pointAt([0, 7]);
            close(a.tail, [0, 10, 0]);
        });

        it("works under a rotated parent and moves children", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10, angle: 1 });
            const b = rig.add("b", { length: 10, parent: a });
            const c = rig.add("c", { length: 10, parent: b });

            b.pointAt([20, 20, 20]);

            const [x, y, z] = [20 - b.head[0], 20 - b.head[1], 20 - b.head[2]];
            const mag = Math.hypot(x, y, z);
            close(b.tail, [b.head[0] + x / mag * 10, b.head[1] + y / mag * 10, b.head[2] + z / mag * 10]);
            close(c.head, b.tail);
        });

        it("changes nothing for a point on the head", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10, angle: 1 });
            a.pointAt(a.head);

            assert.ok(Math.abs(a.angle - 1) < 1e-6);
        });
    });

    describe("moveTo", () => {
        it("places a head under a rotated parent", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10, angle: 1 });
            const b = rig.add("b", { length: 10, parent: a });

            b.moveTo([3, 4, 5]);
            close(b.head, [3, 4, 5]);
        });
    });

    describe("ik on two bones", () => {
        const leg = () => {
            const rig = new Armature();
            const thigh = rig.add("thigh", { length: 10 });
            const shin = rig.add("shin", { length: 10, parent: thigh });
            const foot = rig.add("foot", { length: 2, parent: shin });
            return { rig, thigh, shin, foot, solver: rig.ik(shin, { chain: 2 }) };
        };

        it("puts the tip on a reachable target", () => {
            const { shin, solver } = leg();

            reach(solver, [5, 8]);
            close(shin.tail, [5, 8, 0]);
        });

        it("keeps working in 3D", () => {
            const { thigh, shin, solver } = leg();

            reach(solver, [3, 4, 5], { pole: [0, 0, 10] });
            close(shin.tail, [3, 4, 5]);
            lengthsHold([[thigh.head, thigh.tail, 10], [shin.head, shin.tail, 10]]);
        });

        it("bends towards the pole", () => {
            const { thigh, solver } = leg();

            reach(solver, [10, 0], { pole: [5, 20] });
            assert.ok(thigh.tail[1] > 1);

            reach(solver, [10, 0], { pole: [5, -20] });
            assert.ok(thigh.tail[1] < -1);
        });

        it("bends the way the pose does without a pole", () => {
            const rig = new Armature();
            const thigh = rig.add("thigh", { length: 10, angle: .5 });
            const shin = rig.add("shin", { length: 10, parent: thigh, angle: -1 });

            reach(rig.ik(shin, { chain: 2 }), [12, 0]);
            assert.ok(thigh.tail[1] > 1);
        });

        it("reaches straight for a target too far away", () => {
            const { thigh, shin, solver } = leg();

            reach(solver, [100, 0, 0], { pole: [0, 5] });
            close(thigh.tail, [10, 0, 0]);
            close(shin.tail, [20, 0, 0]);
        });

        it("folds up for a target on the root, without NaN", () => {
            const { thigh, shin, solver } = leg();

            reach(solver, [0, 0]);
            close(shin.tail, [0, 0, 0]);
            lengthsHold([[thigh.head, thigh.tail, 10]]);
        });

        it("stays in the plane from a straight start", () => {
            const { thigh, shin, solver } = leg();

            reach(solver, [10, 0]);
            close(shin.tail, [10, 0, 0]);
            close([thigh.tail[2]], [0]);
        });

        it("moves the bones under it", () => {
            const { shin, foot, solver } = leg();

            reach(solver, [5, 8]);
            close(foot.head, shin.tail);
        });

        it("blends with weight", () => {
            const { thigh, shin, solver } = leg();
            const start = [...shin.tail];

            reach(solver, [5, 8], { weight: 0 });
            close(shin.tail, start);

            reach(solver, [5, 8], { weight: .5 });
            assert.ok(Math.hypot(shin.tail[0] - 5, shin.tail[1] - 8) > 1);
            lengthsHold([[thigh.head, thigh.tail, 10]]);
        });

        it("handles an attach and an offset on the joint", () => {
            const rig = new Armature();
            const upper = rig.add("upper", { length: 10 });
            const lower = rig.add("lower", { length: 10, parent: upper, attach: .8, offset: [0, 2] });

            reach(rig.ik(lower, { chain: 2 }), [9, 9]);
            close(lower.tail, [9, 9, 0], 1e-3);
        });
    });

    describe("ik on a chain", () => {
        const rope = (count = 5) => {
            const rig = new Armature();
            const bones = [rig.add("0", { length: 10, angle: .3 })];
            for (let i = 1; i < count; i++) bones.push(rig.add(`${i}`, { length: 10, parent: bones[i - 1], angle: .3 }));
            return { rig, bones, solver: rig.ik(bones[count - 1]) };
        };
        const measured = bones => lengthsHold(bones.map(bone => [bone.head, bone.tail, 10]));

        it("reaches a target", () => {
            const { bones, solver } = rope();

            reach(solver, [20, 15, 10], { iterations: 30 });
            close(solver.tip, [20, 15, 10], .05);
            measured(bones);
        });

        it("keeps the root in place", () => {
            const { bones, solver } = rope();

            reach(solver, [20, 15]);
            close(bones[0].head, [0, 0, 0]);
        });

        it("stays in the plane for 2D input", () => {
            const { bones, solver } = rope();

            reach(solver, [-20, 15]);
            for (const bone of bones) close([bone.tail[2]], [0]);
        });

        it("reaches straight for a target too far away", () => {
            const { bones, solver } = rope();

            reach(solver, [0, 100]);
            close(solver.tip, [0, 50, 0]);
            measured(bones);
        });

        it("bends a straight chain aimed along its target", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });
            const b = rig.add("b", { length: 10, parent: a });
            const c = rig.add("c", { length: 10, parent: b });
            const solver = rig.ik(c);

            reach(solver, [15, 0], { iterations: 30 });
            close(solver.tip, [15, 0, 0], .05);
            close([c.tail[2]], [0]);
        });

        it("bends towards the pole", () => {
            const { bones, solver } = rope(4);

            const bend = () => bones.reduce((sum, bone) => sum + bone.head[1], 0);

            reach(solver, [20, 0], { pole: [10, 40], iterations: 30 });
            assert.ok(bend() > 1);

            reach(solver, [20, 0], { pole: [10, -40], iterations: 30 });
            assert.ok(bend() < -1);
            close(solver.tip, [20, 0, 0], .1);
        });

        it("aims a single bone", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });

            reach(rig.ik(a, { chain: 1 }), [0, 5]);
            close(a.tail, [0, 10, 0]);
        });

        it("survives a target on the root", () => {
            const { bones, solver } = rope();

            reach(solver, [0, 0, 0]);
            for (const bone of bones) assert.ok(!Number.isNaN(bone.tail[0]));
            measured(bones);
        });

        it("doesn't drift over many solves", () => {
            const { bones, solver } = rope();

            for (let i = 0; i < 1000; i++) reach(solver, [25 * Math.cos(i / 10), 25 * Math.sin(i / 10), i % 7]);
            measured(bones);
            for (const bone of bones) assert.ok(Math.abs(bone.solved.magnitude - 1) < 1e-5);
        });

        it("leaves a chain of zero length alone", () => {
            const rig = new Armature();
            const a = rig.add("a");

            reach(rig.ik(a, { chain: 1 }), [5, 5]);
            close(a.solved, [0, 0, 0, 1]);
        });
    });

    describe("free chains", () => {
        const free = target => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });
            const b = rig.add("b", { length: 10, parent: a });
            rig.ik(b, { free: true, target });
            return { rig, a, b };
        };

        it("drags the tip and the root comes along", () => {
            const { rig, a, b } = free([40, 30]);

            rig.update();

            close(b.tail, [40, 30, 0]);
            lengthsHold([[a.head, a.tail, 10], [b.head, b.tail, 10]]);
            close(b.head, a.tail);
        });

        it("trails behind over many frames", () => {
            const target = [20, 0];
            const { rig, a } = free(target);

            for (; target[0] < 100; target[0] += 5) rig.update();
            close(a.head, [75, 0, 0], 1e-3);
        });
    });

    describe("setPositions", () => {
        it("poses a chain from points", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });
            const b = rig.add("b", { length: 10, parent: a });

            rig.ik(b).setPositions([1, 1, 0, 1, 11, 0, 11, 11, 0]);
            rig.update();

            close(a.head, [1, 1, 0]);
            close(a.tail, [1, 11, 0]);
            close(b.tail, [11, 11, 0]);
        });

        it("throws on the wrong number of values", () => {
            const rig = new Armature();
            const a = rig.add("a");
            assert.throws(() => rig.ik(a).setPositions([1, 2, 3]));
        });
    });

    describe("constraints in update", () => {
        const arm = () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10, angle: .2 });
            const b = rig.add("b", { length: 10, parent: a, angle: .2 });
            const c = rig.add("c", { length: 10, parent: b, angle: .2 });
            return { rig, a, b, c };
        };

        it("runs after forward kinematics", () => {
            const { rig, c } = arm();
            rig.ik(c, { target: [12, 9] });

            rig.update();
            close(c.tail, [12, 9, 0], .05);
        });

        it("reads a moved target on the next update", () => {
            const { rig, c } = arm();
            const target = [12, 9];
            rig.ik(c, { target });

            rig.update();
            target[1] = -9;
            rig.update();

            close(c.tail, [12, -9, 0], .05);
        });

        it("leaves the pose alone, so removing it gives FK back", () => {
            const { rig, a, c } = arm();
            const start = [...c.tail];
            const ik = rig.ik(c, { target: [12, 9] });

            rig.update();
            assert.ok(Math.abs(a.angle - .2) < 1e-6);

            rig.removeIK(ik);
            rig.update();
            close(c.tail, start);
        });

        it("only turns as many bones as chain says", () => {
            const { rig, a, b, c } = arm();
            const start = [...a.tail];
            rig.ik(c, { chain: 2, target: [20, 15] });

            rig.update();

            close(a.tail, start);
            assert.notStrictEqual(b.solved[2], b.rotation[2]);
            close(c.tail, [20, 15, 0]);
        });

        it("goes to the root for chain 0 and stops at it for a long chain", () => {
            const { rig, a, c } = arm();

            assert.strictEqual(rig.ik(c).bones.length, 3);
            assert.strictEqual(rig.ik(c, { chain: 99 }).bones[0], a);
        });

        it("takes a bone as target", () => {
            const { rig, c } = arm();
            const hook = rig.add("hook", { offset: [12, 9] });
            rig.ik(c, { target: hook });

            rig.update();
            close(c.tail, [12, 9, 0], .05);
        });

        it("takes a bone as pole, which follows its parent", () => {
            const rig = new Armature();
            const hips = rig.add("hips");
            const thigh = rig.add("thigh", { length: 10, parent: hips });
            const shin = rig.add("shin", { length: 10, parent: thigh });
            const pole = rig.add("pole", { parent: hips, offset: [5, 20] });
            rig.ik(shin, { chain: 2, target: [10, 0], pole });

            rig.update();
            assert.ok(thigh.tail[1] > 1);

            // the hips move, and the knee keeps to the side of the pole that came along
            hips.offset[1] = -15;
            rig.update();

            close(pole.head, [5, 5, 0]);
            close(shin.tail, [10, 0, 0], .01);

            const side = 10 * (thigh.tail[1] + 15) - 15 * thigh.tail[0];
            assert.ok(side > 0, `${side} should be on the side of the pole`);
        });

        it("does nothing without a target", () => {
            const { rig, c } = arm();
            const start = [...c.tail];
            rig.ik(c);

            rig.update();
            close(c.tail, start);
        });

        it("runs constraints in the order they were added", () => {
            const rig = new Armature();
            const spine = rig.add("spine", { length: 10 });
            const top = rig.add("top", { length: 10, parent: spine });
            const arm = rig.add("arm", { length: 10, parent: top });
            const hand = rig.add("hand", { length: 10, parent: arm });

            rig.ik(top, { chain: 2, target: [5, 15] });
            rig.ik(hand, { chain: 2, target: [15, 10] });
            rig.update();

            close(top.tail, [5, 15, 0], .05);
            close(hand.tail, [15, 10, 0], .05);
        });

        it("throws on a bone from another armature or a negative chain", () => {
            const { rig, c } = arm();
            assert.throws(() => new Armature().ik(c));
            assert.throws(() => rig.ik(c, { chain: -1 }));
        });
    });

    describe("limits", () => {
        const knee = { hinge: [0, 0, 1], min: 0, max: 2.5 };

        it("stops a knee bending backwards", () => {
            const rig = new Armature();
            const thigh = rig.add("thigh", { length: 10 });
            const shin = rig.add("shin", { length: 10, parent: thigh, limit: knee });

            reach(rig.ik(shin, { chain: 2 }), [10, 0], { pole: [5, -20] });

            assert.ok(turned(shin) >= -1e-6, `${turned(shin)} should not be negative`);
        });

        it("leaves a bend inside the limit alone", () => {
            const rig = new Armature();
            const thigh = rig.add("thigh", { length: 10 });
            const shin = rig.add("shin", { length: 10, parent: thigh, limit: knee });
            const solver = rig.ik(shin, { chain: 2 });

            reach(solver, [12, 6], { pole: [0, -20] });
            close(shin.tail, [12, 6, 0], 1e-3);
        });

        it("clamps to max", () => {
            const rig = new Armature();
            const thigh = rig.add("thigh", { length: 10 });
            const shin = rig.add("shin", { length: 10, parent: thigh, limit: { hinge: [0, 0, 1], min: -1, max: 1 } });

            reach(rig.ik(shin, { chain: 2 }), [1, 1]);

            assert.ok(Math.abs(turned(shin)) <= 1 + 1e-6);
        });

        it("keeps a hinge chain in its plane", () => {
            const rig = new Armature();
            const hinge = { hinge: [0, 0, 1], min: -.5, max: .5 };
            const bones = [rig.add("0", { length: 10, limit: hinge })];
            for (let i = 1; i < 5; i++) bones.push(rig.add(`${i}`, { length: 10, parent: bones[i - 1], limit: hinge }));

            reach(rig.ik(bones[4]), [20, 20, 15]);

            for (const bone of bones)
            {
                close([bone.tail[2]], [0]);
                assert.ok(Math.abs(turned(bone)) <= .5 + 1e-5);
            }
        });

        it("holds a cone in a chain", () => {
            const rig = new Armature();
            const bones = [rig.add("0", { length: 10 })];
            for (let i = 1; i < 6; i++) bones.push(rig.add(`${i}`, { length: 10, parent: bones[i - 1], limit: { cone: .4 } }));

            reach(rig.ik(bones[5]), [5, 10, 5]);

            for (const bone of bones.slice(1))
            {
                const parent = bone.parent;
                const a = [(parent.tail[0] - parent.head[0]) / 10, (parent.tail[1] - parent.head[1]) / 10, (parent.tail[2] - parent.head[2]) / 10];
                const b = [(bone.tail[0] - bone.head[0]) / 10, (bone.tail[1] - bone.head[1]) / 10, (bone.tail[2] - bone.head[2]) / 10];
                const cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                assert.ok(Math.acos(Math.min(1, cos)) <= .4 + 1e-3);
            }
        });

        it("reaches what the limits allow", () => {
            const rig = new Armature();
            const bones = [rig.add("0", { length: 10 })];
            for (let i = 1; i < 5; i++) bones.push(rig.add(`${i}`, { length: 10, parent: bones[i - 1], limit: { hinge: [0, 0, 1], min: -1, max: 1 } }));
            const solver = rig.ik(bones[4]);

            reach(solver, [25, 20], { iterations: 40 });

            assert.ok(Math.hypot(solver.tip[0] - 25, solver.tip[1] - 20) < 1);
        });

        it("doesn't touch forward kinematics", () => {
            const rig = new Armature();
            const a = rig.add("a", { length: 10 });
            const b = rig.add("b", { length: 10, parent: a, limit: { cone: .1 } });

            b.angle = 1;
            rig.update();
            assert.ok(Math.abs(b.angle - 1) < 1e-6);
        });
    });

    describe("building", () => {
        it("throws on a duplicate name", () => {
            const rig = new Armature();
            rig.add("a");
            assert.throws(() => rig.add("a"));
        });

        it("throws on a negative length", () => {
            assert.throws(() => new Armature().add("a", { length: -1 }));
        });

        it("throws on a parent from another armature", () => {
            const other = new Armature().add("a");
            assert.throws(() => new Armature().add("b", { parent: other }));
        });

        it("takes bones made elsewhere", () => {
            const a = new Bone("a", { length: 10 });
            const b = new Bone("b", { length: 10, parent: a });

            close(new Armature([a, b]).find("b").tail, [20, 0, 0]);
        });

        it("throws when a child comes before its parent", () => {
            const a = new Bone("a");
            const b = new Bone("b", { parent: a });
            assert.throws(() => new Armature([b, a]));
        });

        it("finds a bone by name", () => {
            const rig = new Armature();
            const a = rig.add("a");

            assert.strictEqual(rig.find("a"), a);
            assert.strictEqual(rig.find("b"), null);
        });
    });
});
