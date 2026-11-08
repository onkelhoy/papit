import { GameEngine } from "@papit/game-engine";
import { Armature } from "@papit/armature";

import { Rig } from "../shared/rig.js";

const PARTS = ["upper-arm", "lower-arm", "pistol-arm", "upper-leg", "lower-leg", "elbow", "knee", "foot", "torso", "head"];

const load = name => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve([name, image]);
    image.src = `public/${name}.svg`;
});
const parts = Object.fromEntries(await Promise.all(PARTS.map(load)));
const ratio = 60 / parts.torso.height;

const controls = Object.fromEntries(
    [...document.querySelectorAll("input")].map(input => [input.name, input])
);

// the rig, in the old game's units with y down and the cowboy facing +x
const rig = new Armature();
const hips = rig.add("hips");
const torso = rig.add("torso", { length: 60, parent: hips });
const head = rig.add("head", { length: parts.head.height * ratio, parent: torso });

const rightThigh = rig.add("right thigh", { length: 40, parent: hips });
const rightShin = rig.add("right shin", { length: 40, parent: rightThigh });
const leftThigh = rig.add("left thigh", { length: 40, parent: hips });
const leftShin = rig.add("left shin", { length: 40, parent: leftThigh });

const rightUpper = rig.add("right upper", { length: 38, parent: torso, attach: .8 });
const rightLower = rig.add("right lower", { length: 38, parent: rightUpper });
const leftUpper = rig.add("left upper", { length: 34, parent: torso, attach: .8, offset: [0, 4] });
const leftLower = rig.add("left lower", { length: 34, parent: leftUpper });

const hand = [0, 0];
const elbowPole = [0, 0];
const leftFoot = [0, 0];
const kneePole = [60, 0];

rig.ik(rightLower, { chain: 2, target: hand, pole: elbowPole });
rig.ik(leftLower, { chain: 2, target: hand, pole: elbowPole });
rig.ik(rightShin, { chain: 2, target: [0, 0], pole: kneePole });
rig.ik(leftShin, { chain: 2, target: leftFoot, pole: kneePole });

class Cowboy extends Rig {
    thickness = 1.5;

    update() {
        const stand = +controls.stand.value;
        const shoot = +controls.shoot.value;

        this.position.x = this.engine.width / 2;
        this.position.y = this.engine.height - 60;
        const size = this.engine.height / 270;
        this.scale.x = size * (controls.mirror.checked ? -1 : 1);
        this.scale.y = size;

        // the same two numbers drove the old body
        const hipsY = -(20 + 60 * stand);
        hips.offset.y = hipsY;

        const bend = -Math.PI / 2 + .3 - .25 * stand - shoot * .12;
        const reachX = Math.cos(bend) * (100 + 60 * stand);
        const reachY = Math.sin(bend) * (100 + 60 * stand);
        const leanAngle = Math.atan2(reachY - hipsY, reachX);
        torso.angle = leanAngle;

        const shoulderX = Math.cos(leanAngle) * 48;
        const shoulderY = hipsY + Math.sin(leanAngle) * 48;

        const aim = -Math.PI / 5 + Math.PI / 3.5 * stand - Math.PI / 3 * shoot;
        const reach = 50 + 20 * stand - 25 * shoot;
        hand[0] = shoulderX + Math.cos(aim) * reach;
        hand[1] = shoulderY + Math.sin(aim) * reach;

        const elbow = aim + Math.PI * 2 / 3;
        elbowPole[0] = hand[0] + Math.cos(elbow) * 30;
        elbowPole[1] = hand[1] + Math.sin(elbow) * 30;

        kneePole[1] = hipsY / 2;
        leftFoot[0] = 10 + (1 - stand) * 20;

        rig.update();
    }

    render(layer) {
        const { ctx } = layer;

        limb(ctx, leftThigh, parts["upper-leg"]);
        limb(ctx, leftShin, parts["lower-leg"]);
        joint(ctx, leftThigh.tail, parts.knee);
        limb(ctx, leftUpper, parts["upper-arm"]);
        limb(ctx, leftLower, parts["lower-arm"]);
        joint(ctx, leftUpper.tail, parts.elbow);
        limb(ctx, torso, parts.torso, true);
        limb(ctx, rightThigh, parts["upper-leg"]);
        limb(ctx, rightShin, parts["lower-leg"]);
        joint(ctx, rightThigh.tail, parts.knee);
        limb(ctx, rightUpper, parts["upper-arm"]);
        limb(ctx, rightLower, parts["pistol-arm"]);
        joint(ctx, rightUpper.tail, parts.elbow);
        limb(ctx, head, parts.head, true);
        foot(ctx, rightShin.tail);
        foot(ctx, leftShin.tail);

        if (controls.bones.checked) super.render(layer);
    }
}

/** A picture on a bone is one `transform`, the bone's matrix already has its place and turn. */
function limb(ctx, bone, image, fromTail = false) {
    const m = bone.worldMatrix;

    ctx.save();
    ctx.transform(m[0], m[1], m[4], m[5], m[12], m[13]);
    if (fromTail) ctx.translate(bone.length, 0);
    ctx.rotate(fromTail ? Math.PI / 2 : -Math.PI / 2);
    ctx.scale(ratio, ratio);
    ctx.drawImage(image, -image.width / 2, 0);
    ctx.restore();
}

function joint(ctx, point, image) {
    ctx.drawImage(
        image,
        point.x - image.width * ratio / 2,
        point.y - image.height * ratio / 2,
        image.width * ratio,
        image.height * ratio,
    );
}

function foot(ctx, point) {
    const width = parts.foot.width * ratio, height = parts.foot.height * ratio;
    ctx.drawImage(parts.foot, point.x, point.y - height, width, height);
}

const engine = new GameEngine({ query: "canvas", theme: true });
engine.add(new Cowboy(rig));
engine.start();
