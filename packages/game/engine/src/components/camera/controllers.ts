import { Vector3 } from "@papit/vector";

import type { Camera } from "./camera";
import { easeFactor } from "./easing";
import type { CameraController, CameraTarget, FollowSetting, FpsSetting, OrbitSetting, PanSetting, ZoomSetting } from "./types";

const MAX_PITCH = Math.PI / 2 - .01;

/** Keeps a target at the center of the view. The first frame lands on it. */
export function follow(target: CameraTarget, setting: FollowSetting = {}): CameraController {
    const goal = Vector3.zero;
    let landed = false;

    return {
        start() {
            landed = false;
        },
        update(camera, dt) {
            const point = "worldPosition" in target ? target.worldPosition : target.position;
            const x = point.x + (setting.offset?.x ?? 0) + camera.offset.x;
            const y = point.y + (setting.offset?.y ?? 0) + camera.offset.y;
            const z = (point.z ?? 0) + (setting.offset?.z ?? 0) + camera.offset.z;
            const { position } = camera;

            if (!landed)
            {
                landed = true;
                goal.set([x, y, z]);
                position.set(goal);
                return;
            }

            if (Math.abs(x - position.x) > (setting.deadzone?.x ?? 0)) goal.x = x;
            if (Math.abs(y - position.y) > (setting.deadzone?.y ?? 0)) goal.y = y;
            if (Math.abs(z - position.z) > (setting.deadzone?.z ?? 0)) goal.z = z;

            position.lerp(goal, easeFactor(setting.ease ?? camera.ease, dt));
        },
    };
}

/** Zooms with the wheel. */
export function zoom(setting: ZoomSetting = {}): CameraController {
    const { min = .25, max = 4, speed = .001 } = setting;
    let goal = 1;
    let release: (() => void) | undefined;

    return {
        start(camera) {
            goal = camera.zoom;
            release = listenWheel(camera, delta => {
                goal = Math.min(Math.max(goal * Math.exp(-delta * speed), min), max);
            });
        },
        update(camera, dt) {
            camera.zoom += (goal - camera.zoom) * easeFactor(setting.ease ?? camera.ease, dt);
        },
        destroy() {
            release?.();
        },
    };
}

/** Drags the view. On top of `follow`, it stays offset from the target. */
export function pan(setting: PanSetting = {}): CameraController {
    let dragX = 0;
    let dragY = 0;
    let release: (() => void) | undefined;

    return {
        start(camera) {
            release = listenDrag(camera, setting.button ?? 0, (x, y) => {
                dragX += x;
                dragY += y;
            });
        },
        update(camera) {
            const { position, offset } = camera;
            const beforeX = position.x;
            const beforeY = position.y;

            position.x -= dragX * devicePixelRatio / camera.zoom;
            position.y -= dragY * devicePixelRatio / camera.zoom;
            dragX = dragY = 0;

            camera.clamp();
            offset.x += position.x - beforeX;
            offset.y += position.y - beforeY;
        },
        destroy() {
            release?.();
        },
    };
}

/** Looks with the mouse once the canvas is clicked and walks with WASD or the arrow keys. */
export function fps(setting: FpsSetting = {}): CameraController {
    const { speed = 5, sensitivity = .002 } = setting;
    let turnX = 0;
    let turnY = 0;
    let release: (() => void) | undefined;

    return {
        start(camera) {
            const element = camera.surface!.element;
            const target = eventTarget(camera);

            const handleclick = () => {
                element.requestPointerLock()?.catch(() => { });
            };
            const handlemousemove = (event: MouseEvent) => {
                if (document.pointerLockElement !== element) return;
                turnX += event.movementX;
                turnY += event.movementY;
            };

            target.addEventListener("click", handleclick);
            document.addEventListener("mousemove", handlemousemove);
            release = () => {
                target.removeEventListener("click", handleclick);
                document.removeEventListener("mousemove", handlemousemove);
                if (document.pointerLockElement === element) document.exitPointerLock();
            };
        },
        update(camera, dt) {
            const { rotation, position } = camera;
            rotation.y -= turnX * sensitivity;
            rotation.x = clampPitch(rotation.x - turnY * sensitivity);
            turnX = turnY = 0;

            const { keyboard } = camera.engine!.input;
            const pressed = (key: string, arrow: string) => keyboard.key(key)?.pressed || keyboard.key(arrow)?.pressed ? 1 : 0;
            const forward = (pressed("w", "arrowup") - pressed("s", "arrowdown")) * speed * dt;
            const right = (pressed("d", "arrowright") - pressed("a", "arrowleft")) * speed * dt;

            const sin = Math.sin(rotation.y);
            const cos = Math.cos(rotation.y);
            position.x += right * cos - forward * sin;
            position.z -= right * sin + forward * cos;
        },
        destroy() {
            release?.();
        },
    };
}

/** Circles a target: drag to turn around it, the wheel to change the distance. */
export function orbit(setting: OrbitSetting = {}): CameraController {
    const { min = 1, max = 100, sensitivity = .005, speed = .001 } = setting;
    const center = setting.target ?? { position: { x: 0, y: 0, z: 0 } };
    let distance = setting.distance ?? 5;
    let yaw = setting.yaw ?? 0;
    let pitch = setting.pitch ?? 0;
    let release: (() => void) | undefined;

    return {
        start(camera) {
            const releaseDrag = listenDrag(camera, 0, (x, y) => {
                yaw -= x * sensitivity;
                pitch = clampPitch(pitch + y * sensitivity);
            });
            const releaseWheel = listenWheel(camera, delta => {
                distance = Math.min(Math.max(distance * Math.exp(delta * speed), min), max);
            });

            release = () => {
                releaseDrag();
                releaseWheel();
            };
        },
        update(camera) {
            const point = "worldPosition" in center ? center.worldPosition : center.position;
            const flat = Math.cos(pitch) * distance;

            camera.rotation.set([-pitch, yaw, 0]);
            camera.position.set([
                point.x + Math.sin(yaw) * flat,
                point.y + Math.sin(pitch) * distance,
                (point.z ?? 0) + Math.cos(yaw) * flat,
            ]);
        },
        destroy() {
            release?.();
        },
    };
}

function clampPitch(pitch: number) {
    return Math.min(Math.max(pitch, -MAX_PITCH), MAX_PITCH);
}

/** Events bubble to the parent, so a camera still hears them under a stacked canvas. */
function eventTarget(camera: Camera) {
    const element = camera.surface!.element;
    return element.parentNode ?? element;
}

function listenWheel(camera: Camera, move: (delta: number) => void) {
    const target = eventTarget(camera);
    const handlewheel = (event: Event) => {
        event.preventDefault();
        move((event as WheelEvent).deltaY);
    };

    target.addEventListener("wheel", handlewheel, { passive: false });
    return () => target.removeEventListener("wheel", handlewheel);
}

function listenDrag(camera: Camera, button: number, move: (x: number, y: number) => void) {
    const target = eventTarget(camera);
    let pointer: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const handlepointerdown = (event: Event) => {
        const { button: pressed, pointerId, clientX, clientY } = event as PointerEvent;
        if (pressed !== button) return;

        pointer = pointerId;
        lastX = clientX;
        lastY = clientY;
    };
    const handlepointermove = (event: PointerEvent) => {
        if (event.pointerId !== pointer) return;

        move(event.clientX - lastX, event.clientY - lastY);
        lastX = event.clientX;
        lastY = event.clientY;
    };
    const handlepointerup = (event: PointerEvent) => {
        if (event.pointerId === pointer) pointer = null;
    };

    target.addEventListener("pointerdown", handlepointerdown);
    window.addEventListener("pointermove", handlepointermove);
    window.addEventListener("pointerup", handlepointerup);

    return () => {
        target.removeEventListener("pointerdown", handlepointerdown);
        window.removeEventListener("pointermove", handlepointermove);
        window.removeEventListener("pointerup", handlepointerup);
    };
}
