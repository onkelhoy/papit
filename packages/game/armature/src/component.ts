import { Bone } from "./bone";
import { IK } from "./ik";
import type { BoneOptions, IKOptions } from "./types";

/**
 * A set of bones in one space. It has no position of its own, so put it inside
 * whatever moves it, such as a GameObject, and read `bone.worldMatrix` from there.
 */
export class Armature {
    readonly bones: Bone[] = [];
    /** Run in this order by `update`, so add a parent's constraint before a child's. */
    readonly constraints: IK[] = [];

    /** Takes bones made with `new Bone`, parents first. */
    constructor(bones: Bone[] = []) {
        for (const bone of bones) this.register(bone);
    }

    /** Creates a bone and adds it. */
    add(name: string, options: BoneOptions = {}) {
        if (options.parent && !this.bones.includes(options.parent))
        {
            throw new Error(`[error armature] the parent of "${name}" is not in this armature`);
        }
        if (this.find(name)) throw new Error(`[error armature] there is already a bone called "${name}"`);

        return this.register(new Bone(name, options));
    }

    find(name: string) {
        return this.bones.find(bone => bone.name === name) ?? null;
    }

    /** Puts an IK constraint on a bone. */
    ik(bone: Bone, options: IKOptions = {}) {
        if (!this.bones.includes(bone)) throw new Error(`[error armature] "${bone.name}" is not in this armature`);

        const constraint = new IK(bone, options);
        this.constraints.push(constraint);
        return constraint;
    }

    /** Takes a constraint off. */
    removeIK(constraint: IK) {
        const index = this.constraints.indexOf(constraint);
        if (index !== -1) this.constraints.splice(index, 1);
    }

    /** Runs forward kinematics, then every IK constraint. Call it once a frame, after changing a pose or a target. */
    update() {
        for (let i = 0; i < this.bones.length; i++)
        {
            const bone = this.bones[i];
            if (!bone.parent) bone.update();
        }

        for (let i = 0; i < this.constraints.length; i++) this.constraints[i].solve();
    }

    private register(bone: Bone) {
        if (this.find(bone.name)) throw new Error(`[error armature] there is already a bone called "${bone.name}"`);
        if (bone.parent && !this.bones.includes(bone.parent))
        {
            throw new Error(`[error armature] the parent of "${bone.name}" has to come first`);
        }

        this.bones.push(bone);
        bone.update();
        return bone;
    }
}
