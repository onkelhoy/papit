import { Armature, Bone } from "@papit/armature";
import type { GLTF } from "./gltf";

export type Rig = {
    armature: Armature;
    /** bone per skin joint, same order as `JOINTS_0` indices */
    bones: Bone[];
    /** bone per glTF node index, for animation channels */
    nodes: Map<number, Bone>;
    /** column major 4x4 per joint, for a `mat4 joints[n]` uniform */
    matrices: Float32Array;
    /** write `bone.worldMatrix * inverseBind` per joint into `matrices`; call after `armature.update()` */
    update(): Float32Array;
};

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/**
 * Build an `@papit/armature` rig from a glTF skin. Each joint node becomes a bone with its
 * translation as `offset` (attached at the parent's head) and its rotation as `rotation`.
 * Node scale and transforms of non-joint ancestors are ignored.
 */
export function rig(gltf: GLTF, skin = 0): Rig {
    const source = gltf.skins[skin];
    if (!source) throw new Error(`gltf: no skin ${skin}`);

    const parentOf = new Map<number, number>();
    gltf.nodes.forEach((node, i) => node.children.forEach(child => parentOf.set(child, i)));
    const isJoint = new Set(source.joints);

    const armature = new Armature();
    const byNode = new Map<number, Bone>();
    const make = (nodeIndex: number): Bone => {
        const existing = byNode.get(nodeIndex);
        if (existing) return existing;
        const node = gltf.nodes[nodeIndex];
        const parentIndex = parentOf.get(nodeIndex);
        const parent = parentIndex !== undefined && isJoint.has(parentIndex) ? make(parentIndex) : undefined;
        const name = node.name && !armature.find(node.name) ? node.name : `joint ${nodeIndex}`;
        const bone = armature.add(name, { parent, attach: 0, offset: node.translation });
        bone.rotation.set(node.rotation);
        byNode.set(nodeIndex, bone);
        return bone;
    };
    const bones = source.joints.map(make);
    armature.update();

    const matrices = new Float32Array(bones.length * 16);
    const inverse = source.inverseBindMatrices;
    return {
        armature, bones, matrices, nodes: byNode,
        update() {
            for (let j = 0; j < bones.length; j++)
            {
                multiply(matrices, j * 16, bones[j].worldMatrix, inverse ?? IDENTITY, inverse ? j * 16 : 0);
            }
            return matrices;
        },
    };
}

// out[o..] = a * b[bo..], column major
function multiply(out: Float32Array, o: number, a: ArrayLike<number>, b: ArrayLike<number>, bo: number) {
    for (let column = 0; column < 4; column++)
    {
        for (let row = 0; row < 4; row++)
        {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[bo + column * 4 + k];
            out[o + column * 4 + row] = sum;
        }
    }
}

/** GLSL for linear blend skinning with the fixed `ATTRIBUTES` layout. */
export const SKINNING_GLSL = `
layout(location = 4) in uvec4 joints;
layout(location = 5) in vec4 weights;
uniform mat4 jointMatrices[64];
mat4 skinMatrix() {
    return weights.x * jointMatrices[joints.x] + weights.y * jointMatrices[joints.y]
         + weights.z * jointMatrices[joints.z] + weights.w * jointMatrices[joints.w];
}`;
