import { Vector2, VectorValue } from "@papit/vector";
import type { Rectangle } from "@papit/box-intersection";
import type { Polygon, Shape } from "types";

export class Projection {
    constructor(public min: number, public max: number) { }

    overlaps(b: Projection) {
        return this.min <= b.max && this.max >= b.min;
    }

    getOverlap(b: Projection) {
        const min = Math.max(this.min, b.min);
        const max = Math.min(this.max, b.max);

        return max - min;
    }
}

export function getMeta(shape: Shape, includevertexindexmap = false): { center: Vector2, boundary: Rectangle, vertexindexmap: Record<string, number> } {

    let minx = Infinity;
    let maxx = -Infinity;
    let miny = Infinity;
    let maxy = -Infinity;
    const center = shape.center ? new Vector2(shape.center) : Vector2.zero;
    let boundary = shape.boundary ?? { x: minx, y: miny, w: 0, h: 0 }

    let vertexindexmap: Record<string, number> = {};

    if (shape.center && shape.boundary && !includevertexindexmap)
        return { center, boundary, vertexindexmap };

    for (let i = 0; i < shape.vertices.length; i++)
    {
        const v = new Vector2(shape.vertices[i]);
        if (!shape.center)
        {
            center.add(v);
        }
        if (!shape.boundary)
        {
            if (minx > v.x) minx = v.x;
            if (miny > v.y) miny = v.y;
            if (maxx < v.x) maxx = v.x;
            if (maxy < v.y) maxy = v.y;
        }

        if (includevertexindexmap)
        {
            vertexindexmap[`${v.x}-${v.y}`] = i;
        }
    }

    if (!shape.center)
    {
        center.divide(shape.vertices.length);
    }
    if (!shape.boundary)
    {
        boundary = {
            x: minx,
            y: miny,
            w: maxx - minx,
            h: maxy - miny,
        };
    }

    return { center, boundary, vertexindexmap };
}

const EPS = 1e-10;
type Axis = { value: Vector2, external: boolean };
export function getAxes(polygon: Polygon, polygonVertexIndexMap: Record<string, number>, shape: Shape) {
    const axes = new Array<Axis>(shape.vertices.length);

    for (let i = 0; i < axes.length; i++)
    {
        const a = new Vector2(shape.vertices[i]);
        const b = new Vector2(shape.vertices[(i + 1) === axes.length ? 0 : i + 1]);

        if (!a || !b) continue;

        const edge = Vector2.subtract(a, b);
        if (edge.magnitude < EPS) continue;

        const value = edge.perpendicular().normalize();
        const external = isOriginalEdge(
            polygon.vertices.length,
            polygonVertexIndexMap[`${a.x}-${a.y}`] ?? 0,
            polygonVertexIndexMap[`${b.x}-${b.y}`] ?? 0,
        );
        axes[i] = { value, external };
    }

    return axes;
}

export function getMTV(axes: Axis[], shape1: Shape, shape2: Shape) {
    let minOverlap = Number.MAX_SAFE_INTEGER;
    let mtvAxis: Vector2 | null = null;

    for (const axis of axes)
    {
        const a = getProjection(axis.value, shape1.vertices);
        const b = getProjection(axis.value, shape2.vertices);

        if (!a.overlaps(b)) return false;
        if (!axis.external) continue;

        const overlap = a.getOverlap(b);
        if (overlap < minOverlap)
        {
            minOverlap = overlap;
            const midA = (a.min + a.max) / 2;
            const midB = (b.min + b.max) / 2;
            mtvAxis = midB < midA ? axis.value.clone.multiply(-1) : axis.value;
        }
    }

    return mtvAxis ? { overlap: minOverlap, axis: mtvAxis } : null;
}

// helper functions 
function isOriginalEdge(n: number, idxA: number, idxB: number) {
    const diff = Math.abs(idxA - idxB);
    return diff === 1 || diff === n - 1;
}

function getProjection(axis: Vector2, vertices: VectorValue[]) {
    let min = axis.dot(vertices[0]);
    let max = min;

    for (let i = 1; i < vertices.length; i++) 
    {
        // NOTE: the axis must be normalized to get accurate projections
        const p = axis.dot(vertices[i]);
        if (p < min)
        {
            min = p;
        }
        else if (p > max)
        {
            max = p;
        }
    }

    return new Projection(min, max);
}