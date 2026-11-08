import { Quaternion } from "@papit/quaternion";
import { Vector3 } from "@papit/vector";

import { Bone } from "./bone";
import type { IKOptions, Point } from "./types";

/** Under this share of the reach, a chain counts as straight. */
const STRAIGHT = 1e-4;
/** How far a straight chain bulges before solving, as a share of its reach. */
const BULGE = .1;

// shared scratch space, so the frame loop doesn't allocate
const from = Vector3.zero;
const to = Vector3.zero;
const side = Vector3.zero;
const swing = Quaternion.identity;

const hasLimit = (bone: Bone) => bone.limit !== null;
/** A bone counts as the point at its head, so a target or pole can follow the rig. */
const pointOf = (value: Point | Bone | null) => value instanceof Bone ? value.head : value;

/**
 * An IK constraint on a bone, like Blender's. It runs in `armature.update`, after forward kinematics,
 * and reaches `target` by turning `chain` bones counted up from `bone`. `target` and `pole` are read on
 * every update, and either can be a bone, so it moves with whatever that bone is parented to. Your `rotation`s stay as they are, the
 * result goes into each bone's `solved`, and `weight` blends between the two.
 */
export class IK {
    /** The bone that reaches, its tail goes to the target. */
    readonly bone: Bone;
    /** The bones this constraint turns, top first. */
    readonly bones: Bone[] = [];

    target: Point | Bone | null;
    pole: Point | Bone | null;
    weight: number;
    iterations: number;
    tolerance: number;
    free: boolean;

    /** Head of each bone, then the tail of the last one, as x, y, z. */
    private points: Float64Array;
    /** Distance between neighbouring points. */
    private gaps: Float64Array;

    constructor(bone: Bone, { chain = 0, target, pole, weight = 1, iterations = 10, tolerance = .01, free = false }: IKOptions = {}) {
        if (chain < 0) throw new Error(`[error armature] the chain of "${bone.name}" can't be negative`);

        this.bone = bone;
        this.target = target ?? null;
        this.pole = pole ?? null;
        this.weight = weight;
        this.iterations = iterations;
        this.tolerance = tolerance;
        this.free = free;

        for (let link: Bone | null = bone; link; link = link.parent)
        {
            this.bones.unshift(link);
            if (this.bones.length === chain) break;
        }

        this.points = new Float64Array((this.bones.length + 1) * 3);
        this.gaps = new Float64Array(this.bones.length);
    }

    /** The tail of `bone`. */
    get tip() {
        return this.bone.tail;
    }

    /** Runs the constraint. `armature.update` calls this, in the order the constraints were added. */
    solve() {
        const target = pointOf(this.target);
        if (!target || this.weight <= 0) return;

        this.read();

        const tx = target[0], ty = target[1], tz = target[2] ?? 0;

        if (this.free) this.drag(tx, ty, tz);
        else if (this.gaps.length === 2) this.exact(tx, ty, tz);
        else this.fabrik(tx, ty, tz);
    }

    /**
     * Poses the bones from points, x, y, z for every head and then the last tail, like the result of a
     * physics step. Directions are used, the bones keep their length. It's stored in their `rotation`.
     */
    setPositions(positions: ArrayLike<number>) {
        if (positions.length !== this.points.length)
        {
            throw new Error(`[error armature] expected ${this.points.length} numbers, got ${positions.length}`);
        }

        this.points.set(positions);
        this.moveRoot();
        this.write(1);
        this.keep();
    }

    /** Any number of bones: FABRIK. A target out of reach gets the chain pointing straight at it. */
    private fabrik(tx: number, ty: number, tz: number) {
        const { points, gaps } = this;
        const pole = pointOf(this.pole);
        const count = gaps.length;
        const rx = points[0], ry = points[1], rz = points[2];

        let reach = 0;
        for (let i = 0; i < count; i++) reach += gaps[i];
        if (reach === 0) return;

        const distance = Math.hypot(tx - rx, ty - ry, tz - rz);
        if (distance >= reach)
        {
            for (let i = 0; i < count; i++)
            {
                const along = gaps[i] / distance;
                points[i * 3 + 3] = points[i * 3] + (tx - rx) * along;
                points[i * 3 + 4] = points[i * 3 + 1] + (ty - ry) * along;
                points[i * 3 + 5] = points[i * 3 + 2] + (tz - rz) * along;
            }
        }
        else
        {
            const limited = this.bones.some(hasLimit);
            this.unfold(tx, ty, tz, reach);

            for (let pass = 0; pass < this.iterations; pass++)
            {
                this.backward(tx, ty, tz);

                points[0] = rx;
                points[1] = ry;
                points[2] = rz;
                for (let i = 0; i < count; i++) this.pull(i + 1, i, gaps[i]);

                if (limited)
                {
                    this.write(1);
                    this.read();
                }

                const tip = count * 3;
                if (Math.hypot(tx - points[tip], ty - points[tip + 1], tz - points[tip + 2]) < this.tolerance) break;
            }

            if (pole) this.bendTowards(pole);
        }

        this.write(this.weight);
    }

    /** Two bones have an exact answer: the law of cosines. */
    private exact(tx: number, ty: number, tz: number) {
        const { points, gaps } = this;
        const pole = pointOf(this.pole);
        const a = gaps[0], b = gaps[1];
        if (a + b === 0) return;

        const rx = points[0], ry = points[1], rz = points[2];
        const length = Math.hypot(tx - rx, ty - ry, tz - rz);

        let dx = 1, dy = 0, dz = 0;
        if (length > 0)
        {
            dx = (tx - rx) / length;
            dy = (ty - ry) / length;
            dz = (tz - rz) / length;
        }

        const distance = Math.min(Math.max(length, Math.abs(a - b)), a + b);

        const found = (pole && this.sideOf(dx, dy, dz, pole[0] - rx, pole[1] - ry, (pole[2] ?? 0) - rz))
            || this.sideOf(dx, dy, dz, points[3] - rx, points[4] - ry, points[5] - rz);
        if (!found) this.anySide(dx, dy);

        const along = distance === 0 ? 0 : (a * a - b * b + distance * distance) / (2 * distance);
        const off = Math.sqrt(Math.max(0, a * a - along * along));

        points[3] = rx + dx * along + side[0] * off;
        points[4] = ry + dy * along + side[1] * off;
        points[5] = rz + dz * along + side[2] * off;

        points[6] = rx + dx * distance;
        points[7] = ry + dy * distance;
        points[8] = rz + dz * distance;

        this.write(this.weight);
    }

    /** A free chain: the tip lands on the target and the rest trails behind, root included. */
    private drag(tx: number, ty: number, tz: number) {
        this.backward(tx, ty, tz);
        this.moveRoot();
        this.write(1);
        this.keep();
    }

    /** Stores the result as the pose, a free chain trails from where it was last frame. */
    private keep() {
        for (let i = 0; i < this.bones.length; i++) this.bones[i].rotation.set(this.bones[i].solved);
    }

    /** Copies the current joints into `points` and measures the gaps between them. */
    private read() {
        const { bones, points, gaps } = this;

        for (let i = 0; i < bones.length; i++)
        {
            bones[i].place();
            points.set(bones[i].head, i * 3);
        }
        points.set(this.bone.tail, bones.length * 3);

        for (let i = 0; i < gaps.length; i++)
        {
            const a = i * 3, b = a + 3;
            gaps[i] = Math.hypot(points[b] - points[a], points[b + 1] - points[a + 1], points[b + 2] - points[a + 2]);
        }
    }

    /** Turns each bone towards its next point, then blends with the pose. */
    private write(weight: number) {
        const { bones, points } = this;

        for (let i = 0; i < bones.length; i++)
        {
            const bone = bones[i];
            bone.place();

            if (i < bones.length - 1)
            {
                bone.attachPoint(bones[i + 1], from);
            }
            else
            {
                from[0] = bone.length;
                from[1] = 0;
                from[2] = 0;
            }
            bone.worldRotation.rotate(from);

            to[0] = points[i * 3 + 3] - bone.head[0];
            to[1] = points[i * 3 + 4] - bone.head[1];
            to[2] = points[i * 3 + 5] - bone.head[2];
            bone.turn(from, to);

            if (bone.limit)
            {
                bone.constrain();
                bone.place();
            }
        }

        if (weight < 1)
        {
            for (let i = 0; i < bones.length; i++) bones[i].solved.nlerp(bones[i].rotation, 1 - weight);
        }

        bones[0].refresh();
    }

    /**
     * Writes the direction square to `dx, dy, dz` that a point `hx, hy, hz` from the root lies on.
     * A hint on the line says nothing, so that returns false.
     */
    private sideOf(dx: number, dy: number, dz: number, hx: number, hy: number, hz: number) {
        const along = (hx * dx + hy * dy + hz * dz) / (dx * dx + dy * dy + dz * dz);
        const x = hx - dx * along, y = hy - dy * along, z = hz - dz * along;
        const length = Math.hypot(x, y, z);

        if (length <= STRAIGHT * Math.hypot(hx, hy, hz)) return false;

        side[0] = x / length;
        side[1] = y / length;
        side[2] = z / length;
        return true;
    }

    /** Writes a direction square to `dx, dy, dz` that stays in the XY plane, so 2D stays 2D. */
    private anySide(dx: number, dy: number) {
        const length = Math.hypot(dx, dy);

        side[0] = length ? -dy / length : 1;
        side[1] = length ? dx / length : 0;
        side[2] = 0;
    }

    private moveRoot() {
        from[0] = this.points[0];
        from[1] = this.points[1];
        from[2] = this.points[2];
        this.bones[0].moveTo(from);
    }

    /** Moves point `index` next to point `anchor`, `gap` away in the direction it already has. */
    private pull(index: number, anchor: number, gap: number) {
        const { points } = this;
        const i = index * 3, a = anchor * 3;
        const x = points[i] - points[a], y = points[i + 1] - points[a + 1], z = points[i + 2] - points[a + 2];
        const length = Math.hypot(x, y, z);

        if (length === 0)
        {
            points[i] = points[a] + gap;
            points[i + 1] = points[a + 1];
            points[i + 2] = points[a + 2];
            return;
        }

        points[i] = points[a] + x / length * gap;
        points[i + 1] = points[a + 1] + y / length * gap;
        points[i + 2] = points[a + 2] + z / length * gap;
    }

    /** The FABRIK pass from the tip: put the tip on the target and let the rest follow. */
    private backward(x: number, y: number, z: number) {
        const { points, gaps } = this;
        const tip = gaps.length * 3;

        points[tip] = x;
        points[tip + 1] = y;
        points[tip + 2] = z;
        for (let i = gaps.length - 1; i >= 0; i--) this.pull(i, i + 1, gaps[i]);
    }

    /** A chain on the line to its target can only slide along it, so bend it first. */
    private unfold(tx: number, ty: number, tz: number, reach: number) {
        const { points, gaps } = this;
        const pole = pointOf(this.pole);
        const dx = tx - points[0], dy = ty - points[1], dz = tz - points[2];
        const count = gaps.length;

        if (count < 2 || (dx === 0 && dy === 0 && dz === 0)) return;

        for (let i = 1; i <= count; i++)
        {
            const a = i * 3;
            const hx = points[a] - points[0], hy = points[a + 1] - points[1], hz = points[a + 2] - points[2];
            if (this.sideOf(dx, dy, dz, hx, hy, hz)) return;
        }

        const found = pole && this.sideOf(
            dx, dy, dz,
            pole[0] - points[0], pole[1] - points[1], (pole[2] ?? 0) - points[2],
        );
        if (!found) this.anySide(dx, dy);

        for (let i = 1; i < count; i++)
        {
            const bulge = Math.sin(Math.PI * i / count) * reach * BULGE;
            points[i * 3] += side[0] * bulge;
            points[i * 3 + 1] += side[1] * bulge;
            points[i * 3 + 2] += side[2] * bulge;
        }
    }

    /** Turns the inner joints as one around the line from root to tip, until their bend faces the pole. */
    private bendTowards(pole: Point) {
        const { points, gaps } = this;
        const tip = gaps.length * 3;
        const rx = points[0], ry = points[1], rz = points[2];

        const length = Math.hypot(points[tip] - rx, points[tip + 1] - ry, points[tip + 2] - rz);
        if (length === 0) return;

        const ax = (points[tip] - rx) / length, ay = (points[tip + 1] - ry) / length, az = (points[tip + 2] - rz) / length;

        // where the bend points now: the sum of how far each joint sits off the line
        let bx = 0, by = 0, bz = 0;
        for (let i = 3; i < tip; i += 3)
        {
            bx += points[i] - rx;
            by += points[i + 1] - ry;
            bz += points[i + 2] - rz;
        }
        if (!this.sideOf(ax, ay, az, bx, by, bz)) return;
        const cx = side[0], cy = side[1], cz = side[2];

        if (!this.sideOf(ax, ay, az, pole[0] - rx, pole[1] - ry, (pole[2] ?? 0) - rz)) return;

        const cos = cx * side[0] + cy * side[1] + cz * side[2];
        const sin = ax * (cy * side[2] - cz * side[1]) + ay * (cz * side[0] - cx * side[2]) + az * (cx * side[1] - cy * side[0]);
        swing.setAxisAngle(ax, ay, az, Math.atan2(sin, cos));

        for (let i = 3; i < tip; i += 3)
        {
            from[0] = points[i] - rx;
            from[1] = points[i + 1] - ry;
            from[2] = points[i + 2] - rz;
            swing.rotate(from);

            points[i] = rx + from[0];
            points[i + 1] = ry + from[1];
            points[i + 2] = rz + from[2];
        }
    }
}
