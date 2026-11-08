import { Matrix4 } from "@papit/matrix";
import { Vector3 } from "@papit/vector";

import { multiplyInto } from "./matrix";

/**
 * Position, rotation and scale are the source of truth, the matrices are derived from them.
 * A vector can't report a change, so reading a matrix compares against the last values used.
 * Rotation is Euler angles in radians, applied Z, then X, then Y.
 */
export class Transform {
    readonly position = Vector3.zero;
    readonly rotation = Vector3.zero;
    readonly scale = new Vector3(1, 1, 1);
    readonly children: Transform[] = [];

    /** Goes up every time `worldMatrix` changes, so a reader can tell it needs to redo its work. */
    worldVersion = 0;

    private currentParent: Transform | null = null;
    private local = new Matrix4();
    private world = new Matrix4();
    private localVersion = 0;
    private lastValues = new Float64Array(9).fill(NaN);
    private lastLocalVersion = -1;
    private lastParent: Transform | null = null;
    private lastParentVersion = -1;

    get parent() {
        return this.currentParent;
    }
    set parent(value: Transform | null) {
        if (value === this.currentParent) return;

        for (let ancestor = value; ancestor; ancestor = ancestor.parent)
        {
            if (ancestor === this) throw new Error("[error engine] a transform can't be its own ancestor");
        }

        const siblings = this.currentParent?.children;
        siblings?.splice(siblings.indexOf(this), 1);

        this.currentParent = value;
        value?.children.push(this);
    }

    /** `translate * rotate * scale`. */
    get localMatrix() {
        if (this.changed()) this.composeLocal();
        return this.local;
    }

    /** `parent.worldMatrix * localMatrix`, or the local matrix without a parent. */
    get worldMatrix() {
        const local = this.localMatrix;
        const parent = this.currentParent;
        const parentWorld = parent?.worldMatrix;
        const parentVersion = parent?.worldVersion ?? -1;

        if (
            this.localVersion === this.lastLocalVersion
            && parent === this.lastParent
            && parentVersion === this.lastParentVersion
        ) return this.world;

        if (parentWorld) multiplyInto(this.world, parentWorld, local);
        else this.world.set(local);

        this.lastLocalVersion = this.localVersion;
        this.lastParent = parent;
        this.lastParentVersion = parentVersion;
        this.worldVersion++;

        return this.world;
    }

    private changed() {
        const values = this.lastValues;
        let changed = false;

        for (let i = 0; i < 3; i++)
        {
            if (values[i] !== this.position[i]) { values[i] = this.position[i]; changed = true; }
            if (values[i + 3] !== this.rotation[i]) { values[i + 3] = this.rotation[i]; changed = true; }
            if (values[i + 6] !== this.scale[i]) { values[i + 6] = this.scale[i]; changed = true; }
        }

        return changed;
    }

    private composeLocal() {
        const cosx = Math.cos(this.rotation[0]), sinx = Math.sin(this.rotation[0]);
        const cosy = Math.cos(this.rotation[1]), siny = Math.sin(this.rotation[1]);
        const cosz = Math.cos(this.rotation[2]), sinz = Math.sin(this.rotation[2]);
        const sx = this.scale[0], sy = this.scale[1], sz = this.scale[2];
        const m = this.local;

        m[0] = (cosy * cosz + siny * sinx * sinz) * sx;
        m[1] = cosx * sinz * sx;
        m[2] = (cosy * sinx * sinz - siny * cosz) * sx;
        m[3] = 0;

        m[4] = (siny * sinx * cosz - cosy * sinz) * sy;
        m[5] = cosx * cosz * sy;
        m[6] = (siny * sinz + cosy * sinx * cosz) * sy;
        m[7] = 0;

        m[8] = siny * cosx * sz;
        m[9] = -sinx * sz;
        m[10] = cosy * cosx * sz;
        m[11] = 0;

        m[12] = this.position[0];
        m[13] = this.position[1];
        m[14] = this.position[2];
        m[15] = 1;

        this.localVersion++;
    }
}
