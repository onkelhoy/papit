import { Vector, Vector3, VectorValue } from "@papit/vector";
import { RectangleObject } from "components/rectangle";

export abstract class Shape extends Vector3 {

    // these needs to be implemented in the classes
    abstract get boundary(): RectangleObject;

    /**
     * function used by GJK algorithm to determine furthest point
     * @param {VectorValue} direction 
     * @returns {Vector} support-point
     */
    abstract supportFunction(direction: VectorValue): Vector;

    /** Same as `supportFunction`, so every shape is a `Convex` for `@papit/gjk`. */
    support(direction: VectorValue): Vector {
        return this.supportFunction(direction);
    }
}