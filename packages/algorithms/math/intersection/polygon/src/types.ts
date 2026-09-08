import { VectorValue } from "@papit/vector";

export type Polygon = {
    vertices: VectorValue[];
    triangles?: number[];
}