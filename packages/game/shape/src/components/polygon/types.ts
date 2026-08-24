import type { VectorValue } from "@papit/vector";
import type { RectangleObject } from "components/rectangle";

export interface PolygonObject {
    vertices: VectorValue[];
    triangles: number[];
    boundaryindex: null | number[];
    concave?: boolean;
    id: number;
    centeroffset?: VectorValue;

    get boundary(): null | RectangleObject;
    get center(): VectorValue;

    getTriangle(i: number): VectorValue[];
}
export type SimplePolygonObject = {
    vertices: VectorValue[];
    triangles: number[];
    boundaryflags?: boolean[];
}
