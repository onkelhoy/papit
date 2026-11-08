import type { Bone } from "./bone";

/** A 3D point or direction. A missing z counts as 0, so `[x, y]` works for 2D. */
export type Point = ArrayLike<number>;

/**
 * How far IK may turn a bone from its parent, in radians.
 * `hinge` only turns around one axis in the parent's space, Z for 2D. `cone` keeps the bone
 * within an angle of the parent's X.
 */
export type BoneLimit =
    | { hinge: Point; min: number; max: number }
    | { cone: number };

export type BoneOptions = {
    /** The bone this one moves with. Must be added first. */
    parent?: Bone;
    /** Distance from head to tail, along the bone's own X. Default 0. */
    length?: number;
    /** Where on the parent the head sits: 0 is its head, 1 its tail. Default 1. */
    attach?: number;
    /** Added to the attach point, in the parent's space. A bone without a parent uses it as its position. */
    offset?: Point;
    /** Turn around Z in radians, the 2D way to set `rotation`. */
    angle?: number;
    /** Applied by IK, forward kinematics stays free. */
    limit?: BoneLimit;
};

export type IKOptions = {
    /** How many bones to turn, counted up from the constrained bone. 0 goes all the way to the root. Default 0. */
    chain?: number;
    /** The point to reach, or a bone to reach the head of. Without one the constraint does nothing. */
    target?: Point | Bone;
    /** A point or bone the joints bend towards, like a knee aiming at a spot in front of the leg. Use a bone to make it follow the rig. */
    pole?: Point | Bone;
    /** How much the result replaces the pose, 0 to 1. Default 1. */
    weight?: number;
    /** The most passes to run, for chains longer than 2. Default 10. */
    iterations?: number;
    /** How close the tip has to get to stop early. Default 0.01. */
    tolerance?: number;
    /** Lets the root move too, so the chain trails behind the target like a snake or a rope. Default false. */
    free?: boolean;
};
