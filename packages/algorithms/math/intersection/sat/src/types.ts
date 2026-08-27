import type { Rectangle } from "@papit/box-intersection";
import type { VectorValue } from "@papit/vector"

export type VertexReference = number[] | (any | VectorValue)[] | VectorValue[] | number[][] | VectorValue[][];
export type Shape = { vertices: VectorValue[]; boundary: Rectangle; center: VectorValue; };

export type Polygon = {
    vertices: VectorValue[];
    center?: VectorValue;
    boundary?: Rectangle;
    triangles?: VertexReference;
    shapes?: Shape[] | VertexReference;

    boundaryindex?: number[];
    boundaryIndex?: number[];

    getVertex?(i: number): VectorValue;
    getTriangle?(i: number): VectorValue[];
}