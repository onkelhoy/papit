import { Vector, Vector2, type VectorValue } from "@papit/vector";
import { Polygon, Shape } from "types";

export function getShapes(polygon: Polygon): Shape[] {
    if (polygon.shapes)
    {
        if ('vertices' in polygon.shapes[0])
        {
            return polygon.shapes as Shape[];
        }

        return [];
    }

    if (polygon.triangles)
    {
        return [];
    }

    return [];
}

function extractVertices(polygon: Polygon,)


// Public API

// export function getBoundary(polygon: Polygon) {
//     // 1. If a pre‑computed boundary exists, return it.
//     if (polygon.boundary) return polygon.boundary;

//     // 2. Determine which vertex indices to use.
//     let indices = polygon.boundaryIndex || polygon.boundaryindex;


//     // 3. Compute min/max from those vertices.
//     let minX = Infinity, maxX = -Infinity;
//     let minY = Infinity, maxY = -Infinity;

//     if (!indices || indices.length === 0)
//     {
//         // Fallback: use all vertices 
//         for (const vv of polygon.vertices) 
//         {
//             const v = toVector(vv);
//             if (v.x < minX) minX = v.x;
//             if (v.x > maxX) maxX = v.x;
//             if (v.y < minY) minY = v.y;
//             if (v.y > maxY) maxY = v.y;
//         }
//     }
//     else 
//     {
//         for (const idx of indices)
//         {
//             const v = getVertex(polygon, idx); // assumes getVertex exists
//             if (v.x < minX) minX = v.x;
//             if (v.x > maxX) maxX = v.x;
//             if (v.y < minY) minY = v.y;
//             if (v.y > maxY) maxY = v.y;
//         }
//     }

//     if (minX === Infinity) return null;

//     return {
//         x: minX,
//         y: minY,
//         w: maxX - minX,
//         h: maxY - minY,
//     };
// }
// import { Vector, Vector2, type VectorValue } from "@papit/vector";
// import { Polygon, Shape } from "types";


// // Public API

// export function getBoundary(polygon: Polygon) {
//     // 1. If a pre‑computed boundary exists, return it.
//     if (polygon.boundary) return polygon.boundary;

//     // 2. Determine which vertex indices to use.
//     let indices = polygon.boundaryIndex || polygon.boundaryindex;


//     // 3. Compute min/max from those vertices.
//     let minX = Infinity, maxX = -Infinity;
//     let minY = Infinity, maxY = -Infinity;

//     if (!indices || indices.length === 0)
//     {
//         // Fallback: use all vertices 
//         for (const vv of polygon.vertices) 
//         {
//             const v = toVector(vv);
//             if (v.x < minX) minX = v.x;
//             if (v.x > maxX) maxX = v.x;
//             if (v.y < minY) minY = v.y;
//             if (v.y > maxY) maxY = v.y;
//         }
//     }
//     else 
//     {
//         for (const idx of indices)
//         {
//             const v = getVertex(polygon, idx); // assumes getVertex exists
//             if (v.x < minX) minX = v.x;
//             if (v.x > maxX) maxX = v.x;
//             if (v.y < minY) minY = v.y;
//             if (v.y > maxY) maxY = v.y;
//         }
//     }

//     if (minX === Infinity) return null;

//     return {
//         x: minX,
//         y: minY,
//         w: maxX - minX,
//         h: maxY - minY,
//     };
// }

// export function getShapes(polygon: Polygon): VectorValue[][] {
//     if (polygon.shapes)
//     {
//         const shapes = parseShape(polygon, polygon.shapes);
//         if (shapes.length > 0) return shapes;
//     }

//     const triangles = polygon.triangles;
//     if (triangles)
//     {
//         const second = triangles[1];
//         if (isVectorValue(second))
//         {
//             return new Array(triangles.length / 3).fill(0).map((_, i) => [triangles[i], triangles[i + 1], triangles[i + 2]])
//         }

//         if (typeof second === "number")
//         {
//             if (polygon.getTriangle)
//             {
//                 return new Array(triangles.length / 3).fill(0).map((_, i) => polygon.getTriangle!(i))
//             }
//             return new Array(triangles.length / 3).fill(0).map((_, i) => [getVertex(polygon, i), getVertex(polygon, i + 1), getVertex(polygon, i + 2)])
//         }

//         return parseShape(polygon, triangles);
//     }

//     return [];
// }

// // Helper: determine if a value is a VectorValue (object, not array)
// function isVectorValue(value: any): value is VectorValue {
//     return value !== null && typeof value === "object" && !Array.isArray(value);
// }

// // Helper: get a vertex by index, using polygon.getVertex if available
// function getVertex(polygon: Polygon, index: number) {
//     return toVector(polygon.getVertex ? polygon.getVertex(index) : polygon.vertices[index]);
// }
// function toVector(vector: VectorValue) {
//     if (vector instanceof Vector) return vector;
//     return new Vector2(vector);
// }

// // Core parser: converts any Shape into VectorValue[][]
// function parseShape(polygon: Polygon, shape: Shape): VectorValue[][] {
//     if (!shape || (Array.isArray(shape) && shape.length === 0))
//     {
//         return [];
//     }

//     // 1. Nested array: shape[0] is an array
//     if (Array.isArray(shape[0]))
//     {
//         const firstInner = shape[0];
//         if (firstInner.length === 0) return [];

//         if (typeof firstInner[0] === "number")
//         {
//             // number[][] → indices
//             return (shape as number[][]).map((indices) =>
//                 indices.map((i) => getVertex(polygon, i))
//             );
//         } else
//         {
//             // VectorValue[][] → already vertices
//             return shape as VectorValue[][];
//         }
//     }

//     // 2. Flat array
//     const allNumbers = shape.every((item) => typeof item === "number");
//     const allVector = shape.every((item) => isVectorValue(item));

//     if (allNumbers)
//     {
//         // single shape via indices
//         return [(shape as number[]).map((i) => getVertex(polygon, i))];
//     }

//     if (allVector)
//     {
//         // single shape via direct vertices
//         return [shape as VectorValue[]];
//     }

//     // 3. Mixed: numbers are breakpoints, VectorValue are vertices
//     const result: VectorValue[][] = [];
//     let currentGroup: VectorValue[] = [];

//     for (const item of shape)
//     {
//         if (isVectorValue(item))
//         {
//             currentGroup.push(item);
//         } else
//         {
//             // breakpoint – push current group if non‑empty, then reset
//             if (currentGroup.length > 0)
//             {
//                 result.push(currentGroup);
//                 currentGroup = [];
//             }
//             // breakpoint value (e.g. size hint) is ignored
//         }
//     }

//     // push the last group if any
//     if (currentGroup.length > 0)
//     {
//         result.push(currentGroup);
//     }

//     return result;
// }