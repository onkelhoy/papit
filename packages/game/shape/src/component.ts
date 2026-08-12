import { Vector, VectorValue } from "@papit/vector";
import { RectangleObject } from "components/rectangle";

export abstract class Shape extends Vector {

    // these needs to be implemented in the classes
    abstract get boundary(): RectangleObject;

    /**
     * function used by GJK algorithm to determine furthest point
     * @param {VectorValue} direction 
     * @returns {Vector2Object} support-point
     */
    abstract supportFunction(direction: VectorValue): VectorValue;
}