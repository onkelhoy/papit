import type { GameEngine } from "../../engine/game-engine";
import { GameObject } from "../gameobject";

/** The root of the object tree. Every game object lives under it. */
export class World extends GameObject {
    constructor(engine: GameEngine) {
        super();
        this.engine = engine;
    }
}
