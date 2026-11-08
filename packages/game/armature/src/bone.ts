import { Matrix4 } from "@papit/matrix";
import { Quaternion } from "@papit/quaternion";
import { Vector3 } from "@papit/vector";

import { setPoint } from "./helper";
import type { BoneLimit, BoneOptions, Point } from "./types";

// shared scratch space, so the frame loop doesn't allocate
const turn = Quaternion.identity;
const swing = Quaternion.identity;
const from = Vector3.zero;
const to = Vector3.zero;

/**
 * One rigid segment, pointing along its own +X from `head` to `tail`.
 * `length`, `attach`, `offset` and `rotation` are the pose, the rest is derived from them
 * by `update`. All world values are in armature space, and they're the same objects on every read.
 */
export class Bone {
    readonly name: string;
    readonly parent: Bone | null;
    readonly children: Bone[] = [];

    readonly offset = Vector3.zero;
    /** The pose you set, relative to the parent. IK leaves it alone. */
    readonly rotation = Quaternion.identity;
    /** The rotation in use: `rotation` until an IK constraint turns the bone. */
    readonly solved = Quaternion.identity;

    readonly head = Vector3.zero;
    readonly tail = Vector3.zero;
    readonly worldRotation = Quaternion.identity;
    /** At `head`, with X along the bone. Holds no length, so it's safe to draw a picture with. */
    readonly worldMatrix = new Matrix4();

    length: number;
    attach: number;
    limit: BoneLimit | null;

    constructor(name: string, { parent, length = 0, attach = 1, offset, angle, limit }: BoneOptions = {}) {
        if (length < 0) throw new Error(`[error armature] bone "${name}" can't have a negative length`);

        this.name = name;
        this.parent = parent ?? null;
        this.length = length;
        this.attach = attach;
        this.limit = limit ?? null;

        if (offset) setPoint(this.offset, offset);
        if (angle !== undefined) this.angle = angle;
        this.parent?.children.push(this);
    }

    /** Turn around Z in radians. Only meaningful while the bone rotates around Z, as it does in 2D. */
    get angle() {
        const angle = 2 * Math.atan2(this.rotation[2], this.rotation[3]);
        if (angle > Math.PI) return angle - 2 * Math.PI;
        if (angle <= -Math.PI) return angle + 2 * Math.PI;
        return angle;
    }
    set angle(value: number) {
        this.rotation.setAxisAngle(0, 0, 1, value);
    }

    /** Forward kinematics: takes `rotation` as it is for this bone and everything under it. */
    update() {
        this.solved.set(this.rotation);
        this.place();
        for (let i = 0; i < this.children.length; i++) this.children[i].update();
    }

    /** Recomputes the world values of this bone and everything under it, keeping `solved`. */
    refresh() {
        this.place();
        for (let i = 0; i < this.children.length; i++) this.children[i].refresh();
    }

    /** Recomputes this bone only. Its parent has to be current. */
    place() {
        const parent = this.parent;

        if (parent)
        {
            parent.attachPoint(this, this.head);
            parent.worldRotation.rotate(this.head);
            this.head[0] += parent.head[0];
            this.head[1] += parent.head[1];
            this.head[2] += parent.head[2];
            Quaternion.multiplyInto(this.worldRotation, parent.worldRotation, this.solved);
        }
        else
        {
            this.head.set(this.offset);
            this.worldRotation.set(this.solved);
        }

        this.tail[0] = this.length;
        this.tail[1] = 0;
        this.tail[2] = 0;
        this.worldRotation.rotate(this.tail);
        this.tail[0] += this.head[0];
        this.tail[1] += this.head[1];
        this.tail[2] += this.head[2];

        this.worldRotation.writeMatrix(this.worldMatrix, this.head);
    }

    /** Writes where `child`'s head sits, in this bone's own space. */
    attachPoint(child: Bone, out: Vector3) {
        out[0] = this.length * child.attach + child.offset[0];
        out[1] = child.offset[1];
        out[2] = child.offset[2];
        return out;
    }

    /**
     * Sets `rotation` so `tail` points at a point in armature space, and updates everything under it.
     * The bone keeps its twist. The bone's head has to be current. A point on the head changes nothing.
     */
    pointAt(target: Point) {
        setPoint(to, target);
        to[0] -= this.head[0];
        to[1] -= this.head[1];
        to[2] -= this.head[2];

        from[0] = 1;
        from[1] = 0;
        from[2] = 0;
        this.worldRotation.rotate(from);

        this.turn(from, to);
        this.rotation.set(this.solved);
        this.update();
    }

    /** Turns `solved` by the shortest rotation that takes direction `a` to direction `b`, both in armature space. */
    turn(a: Point, b: Point) {
        turn.setFromTo(a, b);
        Quaternion.multiplyInto(this.worldRotation, turn, this.worldRotation);

        const parent = this.parent;
        if (parent)
        {
            turn.set(parent.worldRotation);
            turn.conjugate();
            Quaternion.multiplyInto(this.solved, turn, this.worldRotation);
        }
        else
        {
            this.solved.set(this.worldRotation);
        }

        this.solved.normalize();
        this.place();
    }

    /** Pulls `solved` back inside `limit`. IK calls this, the bone still needs a `place` after. */
    constrain() {
        const limit = this.limit;
        if (!limit) return;

        if ("cone" in limit) this.constrainCone(limit.cone);
        else this.constrainHinge(limit.hinge, limit.min, limit.max);
    }

    /** Moves the head to a point in armature space by changing `offset`. */
    moveTo(point: Point) {
        setPoint(to, point);

        const parent = this.parent;
        if (parent)
        {
            to[0] -= parent.head[0];
            to[1] -= parent.head[1];
            to[2] -= parent.head[2];

            turn.set(parent.worldRotation);
            turn.conjugate().rotate(to);

            this.offset.set(to);
            this.offset[0] -= parent.length * this.attach;
        }
        else
        {
            this.offset.set(to);
        }

        this.place();
    }

    /** Keeps only the part of the rotation around the axis, then clamps its angle. */
    private constrainHinge(axis: Point, min: number, max: number) {
        const q = this.solved;
        const x = axis[0], y = axis[1], z = axis[2] ?? 0;

        const along = (q[0] * x + q[1] * y + q[2] * z) / Math.hypot(x, y, z);
        let angle = 2 * Math.atan2(along, q[3]);
        if (angle > Math.PI) angle -= 2 * Math.PI;
        if (angle <= -Math.PI) angle += 2 * Math.PI;

        q.setAxisAngle(x, y, z, Math.min(Math.max(angle, min), max));
    }

    /** Splits the rotation into a swing off X and a twist around it, and shortens the swing. */
    private constrainCone(cone: number) {
        const q = this.solved;

        from[0] = 1;
        from[1] = 0;
        from[2] = 0;
        q.rotate(from);
        if (Math.acos(Math.min(Math.max(from[0], -1), 1)) <= cone) return;

        to[0] = 1;
        to[1] = 0;
        to[2] = 0;
        swing.setFromTo(to, from);

        turn.set(swing);
        turn.conjugate();
        Quaternion.multiplyInto(q, turn, q);

        swing.setAxisAngle(swing[0], swing[1], swing[2], cone);
        Quaternion.multiplyInto(q, swing, q);
        q.normalize();
    }
}
