import type { Camera } from "./camera";
import type { Easing } from "./easing";

export type CameraProjection = "orthographic" | "perspective";

export type CameraBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Moves a camera. Controllers stack, each runs in order after everything else has moved. */
export type CameraController = {
    start?(camera: Camera): void;
    update(camera: Camera, dt: number): void;
    /** Releases what `start` set up. */
    destroy?(): void;
}

export type CameraSetting = {
    projection?: CameraProjection;
    zoom?: number;
    fov?: number;
    near?: number;
    far?: number;
    bounds?: CameraBounds;
    /** Used by controllers without their own. Defaults to 1, no easing. */
    ease?: Easing;
    controllers?: CameraController[];
}

type Point = { x: number; y: number; z?: number };

/** A game object, or anything else with a position. */
export type CameraTarget = { worldPosition: Point } | { position: Point };

export type FollowSetting = {
    ease?: Easing;
    /** How far the target can be from the center, per axis, before the camera moves. */
    deadzone?: { x?: number; y?: number; z?: number };
    /** Added to the target, like `{ z: 10 }` to stay behind it in 3D. */
    offset?: { x?: number; y?: number; z?: number };
}

export type ZoomSetting = {
    min?: number;
    max?: number;
    /** Zoom change per wheel pixel. */
    speed?: number;
    ease?: Easing;
}

export type PanSetting = {
    /** The pointer button that drags, 0 is the main one. */
    button?: number;
}

export type FpsSetting = {
    /** Units per second. */
    speed?: number;
    /** Radians per mouse pixel. */
    sensitivity?: number;
}

export type OrbitSetting = {
    /** What to circle. Defaults to the origin. */
    target?: CameraTarget;
    distance?: number;
    min?: number;
    max?: number;
    /** Radians around the target, 0 is on its +z side. */
    yaw?: number;
    /** Radians above the target. */
    pitch?: number;
    /** Radians per dragged pixel. */
    sensitivity?: number;
    /** Distance change per wheel pixel, as a fraction. */
    speed?: number;
}
