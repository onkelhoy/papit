import { Vector3, VectorValue } from "@papit/vector";
import { RectangleObject } from "components/rectangle";

export abstract class Shape extends Vector3 {

    // these needs to be implemented in the classes
    abstract get boundary(): RectangleObject;

    /**
     * function used by GJK algorithm to determine furthest point
     * @param {VectorValue} direction 
     * @returns {VectorValue} support-point
     */
    abstract supportFunction(direction: VectorValue): VectorValue;
}