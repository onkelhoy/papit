import type { GameEngine } from "../../engine/game-engine";
import type { Layer2D } from "../../engine/layer-2d";
import type { Layer3D } from "../../engine/layer-3d";
import { Transform } from "../transform";
import { Emitter } from "./emitter";

type Phase = "fixedUpdate" | "update" | "lateUpdate";

/**
 * A thing in the game. Extend it and override the lifecycle methods you need,
 * `add` it to the engine or to another object, and children move with their parent.
 * It emits `start` and `destroy`.
 */
export class GameObject extends Emitter {
    readonly transform = new Transform();
    readonly children: GameObject[] = [];

    name = "";
    /** Layer name to draw on, inherited by children. Without one, the default layer. */
    layer?: string;
    /** Set once the object is in a world. */
    engine: GameEngine | null = null;
    parent: GameObject | null = null;

    protected started = false;
    private worldPoint = { x: 0, y: 0, z: 0 };

    get position() {
        return this.transform.position;
    }
    get rotation() {
        return this.transform.rotation;
    }
    get scale() {
        return this.transform.scale;
    }
    get worldMatrix() {
        return this.transform.worldMatrix;
    }
    /** Where the object is after its parents, the same object on every read. */
    get worldPosition() {
        const matrix = this.worldMatrix;
        this.worldPoint.x = matrix[12];
        this.worldPoint.y = matrix[13];
        this.worldPoint.z = matrix[14];
        return this.worldPoint;
    }

    // lifecycle, all optional
    /** Runs once, before the object's first update. */
    start() { }
    /** Runs at a fixed rate, `dt` is always the same. Use it for physics. */
    fixedUpdate(dt: number) { }
    /** Runs every frame, `dt` is the seconds since the last one. */
    update(dt: number) { }
    /** Runs every frame after every `update`, so a camera can follow what moved. */
    lateUpdate(dt: number) { }
    /** Draws the object. The context of a 2D layer is already placed at this object. */
    render(layer: Layer2D | Layer3D) { }
    /** Runs when the object leaves the world. */
    destroy() { }

    /** Adds a child, moving it from its current parent if it has one. */
    add<T extends GameObject>(child: T) {
        child.transform.parent = this.transform;

        const siblings = child.parent?.children;
        siblings?.splice(siblings.indexOf(child), 1);

        child.parent = this;
        this.children.push(child);
        child.join(this.engine);
        return child;
    }

    /** Removes a child, then runs `destroy` on it and everything under it. */
    remove(child: GameObject) {
        const index = this.children.indexOf(child);
        if (index === -1) return;

        this.children.splice(index, 1);
        child.transform.parent = null;
        child.parent = null;
        child.leave();
    }

    /** The first object under this one with this name, or matching this check. */
    find(match: string | ((object: GameObject) => boolean)): GameObject | null {
        for (const child of this.children)
        {
            const found = typeof match === "string" ? child.name === match : match(child);
            if (found) return child;

            const nested = child.find(match);
            if (nested) return nested;
        }
        return null;
    }

    /** Runs one phase on this object, then on its children. The engine calls this. */
    step(phase: Phase, dt: number) {
        if (!this.started)
        {
            this.started = true;
            this.start();
            this.emit("start");
        }

        this[phase](dt);
        if (!this.engine) return; // it left during its own step

        for (let i = 0; i < this.children.length; i++)
        {
            const child = this.children[i];
            child.step(phase, dt);
            if (this.children[i] !== child) i--; // it left during its step, so the next one moved here
        }
    }

    /** Draws this object, then its children. The engine calls this. */
    draw() {
        if (this.engine && this.render !== GameObject.prototype.render)
        {
            const layer = this.engine.layer(this.layerName()) ?? this.engine.defaultLayer;
            layer.place(this.worldMatrix, this.engine.frame);
            this.render(layer);
        }

        for (const child of this.children) child.draw();
    }

    private layerName(): string | undefined {
        return this.layer ?? this.parent?.layerName();
    }

    private join(engine: GameEngine | null) {
        this.engine = engine;
        for (const child of this.children) child.join(engine);
    }

    private leave() {
        for (const child of this.children) child.leave();

        this.destroy();
        this.emit("destroy");
        this.engine = null;
        this.started = false;
    }
}
