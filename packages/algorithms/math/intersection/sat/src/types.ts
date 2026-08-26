import type { Rectangle } from "@papit/box-intersection";
import type { VectorValue } from "@papit/vector"

export type Shape = number[] | (any | VectorValue)[] | VectorValue[] | number[][] | VectorValue[][];;
export type Polygon = {
    vertices: VectorValue[];
    triangles?: Shape;
    shapes?: Shape;
    boundary?: Rectangle;
    boundaryindex?: number[];
    boundaryIndex?: number[];
    getVertex?(i: number): VectorValue;
    getTriangle?(i: number): VectorValue[];
}