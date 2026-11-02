import { Matrix4 } from "@papit/matrix";

import type { Layer } from "../../engine/layer";
import { GameObject } from "../gameobject";
import type { CameraBounds, CameraController, CameraProjection, CameraSetting } from "./types";
import type { Easing } from "./easing";

/**
 * What a layer is seen through. Set it with `layer.camera = new Camera()`.
 * Its position is the point at the center of the view, and controllers do the moving.
 * The projection defaults to orthographic on a 2D layer and perspective on a 3D one.
 */
export class Camera extends GameObject {
    projection?: CameraProjection;
    zoom: number;
    /** Vertical field of view in radians, for perspective. */
    fov: number;
    near: number;
    far: number;
    /** The view stays inside this rectangle, orthographic only. */
    bounds?: CameraBounds;
    ease: Easing;
    controllers: CameraController[];
    /** How far `pan` moved away from what `follow` aims at. */
    readonly offset = { x: 0, y: 0, z: 0 };
    /** The layer this camera reads its size from. */
    surface: Layer | null = null;

    private view = new Matrix4();
    private projected = new Matrix4();
    private viewVersion = -1;
    private lastFrame = -1;
    private shakeTime = 0;
    private shakeMagnitude = 0;
    private shakeX = 0;
    private shakeY = 0;

    constructor(setting: CameraSetting = {}) {
        super();
        this.projection = setting.projection;
        this.zoom = setting.zoom ?? 1;
        this.fov = setting.fov ?? Math.PI / 3;
        this.near = setting.near ?? 0.1;
        this.far = setting.far ?? 1000;
        this.bounds = setting.bounds;
        this.ease = setting.ease ?? 1;
        this.controllers = setting.controllers ?? [];
    }

    get width() {
        return this.surface?.width ?? 0;
    }
    get height() {
        return this.surface?.height ?? 0;
    }

    /** The inverse of the camera's world matrix, shake included. */
    get viewMatrix() {
        const world = this.worldMatrix;
        if (this.viewVersion !== this.transform.worldVersion)
        {
            this.viewVersion = this.transform.worldVersion;
            this.view.set(world);
            this.view.inverseTRS();
        }

        if (this.shakeX === 0 && this.shakeY === 0) return this.view;

        this.viewVersion = -1;
        this.view[12] += this.shakeX;
        this.view[13] += this.shakeY;
        return this.view;
    }

    /** For a 3D layer, in clip space. Orthographic shows 2 units high at zoom 1. */
    get projectionMatrix() {
        const aspect = this.height ? this.width / this.height : 1;

        if (this.projection === "orthographic")
        {
            const top = 1 / this.zoom;
            const right = top * aspect;
            this.projected.identity();
            this.projected.orthographic(-right, right, -top, top, this.near, this.far);
        }
        else
        {
            const fov = 2 * Math.atan(Math.tan(this.fov / 2) / this.zoom);
            this.projected.perspective(fov, aspect, this.near, this.far);
        }

        return this.projected;
    }

    /** Called when the camera is set on a layer. */
    attach(layer: Layer) {
        this.surface ??= layer;
        this.engine ??= layer.engine;
        this.projection ??= layer.setting.type === "2d" ? "orthographic" : "perspective";
    }

    /** Called when the camera is taken off a layer. */
    detach() {
        this.destroy();
        this.started = false;
        this.surface = null;
    }

    override start() {
        for (const controller of this.controllers) controller.start?.(this);
    }

    override lateUpdate(dt: number) {
        // a camera can be on several layers, or in the world as well
        if (this.engine)
        {
            if (this.engine.frame === this.lastFrame) return;
            this.lastFrame = this.engine.frame;
        }

        for (const controller of this.controllers) controller.update(this, dt);
        this.clamp();
        this.updateShake(dt);
    }

    override destroy() {
        for (const controller of this.controllers) controller.destroy?.();
    }

    /** Shakes the view for `duration` seconds, `magnitude` is the size in canvas pixels. */
    shake(duration = .3, magnitude = 8) {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        this.shakeTime = duration;
        this.shakeMagnitude = magnitude;
    }

    /** Pulls the view back inside `bounds`. A view larger than `bounds` is centered on them. */
    clamp() {
        if (!this.bounds || this.projection !== "orthographic") return;

        const { x, y, width, height } = this.bounds;
        const { position } = this;
        position.x = clampAxis(position.x, x, width, this.width / this.zoom);
        position.y = clampAxis(position.y, y, height, this.height / this.zoom);
    }

    private updateShake(dt: number) {
        this.shakeTime -= dt;
        const shaking = this.shakeTime > 0;

        this.shakeX = shaking ? (Math.random() * 2 - 1) * this.shakeMagnitude : 0;
        this.shakeY = shaking ? (Math.random() * 2 - 1) * this.shakeMagnitude : 0;
    }
}

function clampAxis(value: number, start: number, size: number, view: number) {
    if (view >= size) return start + size / 2;
    return Math.min(Math.max(value, start + view / 2), start + size - view / 2);
}
