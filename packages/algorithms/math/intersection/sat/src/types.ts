import type { Rectangle } from "@papit/box-intersection";
import type { VectorValue } from "@papit/vector"

export type Shape = { vertices: VectorValue[]; boundary?: Rectangle; center?: VectorValue; };

export type Polygon = {
    vertices: VectorValue[];
    center?: VectorValue;
    boundary?: Rectangle;
    triangles?: number[];
    shapes?: any[];

    getShape?(i: number): VectorValue[] | Shape | undefined;
    getVertex?(i: number): VectorValue | undefined;
    getTriangle?(i: number): VectorValue[] | undefined;
}