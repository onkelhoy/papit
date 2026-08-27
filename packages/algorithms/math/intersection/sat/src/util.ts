import { Vector2, VectorValue } from "@papit/vector";
import { Polygon, Shape } from "types";

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

const EPS = 1e-10;
export function getAxes(polygonVertexIndexMap: Record<string, number>, shape: Partial<Shape> & { vertices: VectorValue[] }) {
    const axes = new Array<{ normal: Vector2, internal: boolean }>(shape.vertices.length);

    let minx = Infinity;
    let maxx = -Infinity;
    let miny = Infinity;
    let maxy = -Infinity;
    const center = Vector2.zero;

    for (let i = 0; i < axes.length; i++)
    {
        const a = new Vector2(shape.vertices[i]);
        if (!shape.center)
        {
            center.add(a);
        }
        if (!shape.boundary)
        {
            if (minx > a.x) minx = a.x;
            if (miny > a.y) miny = a.y;
            if (maxx < a.x) maxx = a.x;
            if (maxy < a.y) maxy = a.y;
        }

        const b = new Vector2(shape.vertices[(i + 1) === axes.length ? 0 : i + 1]);
        if (!a || !b) continue;

        const edge = Vector2.subtract(a, b);
        if (edge.magnitude < EPS) continue;
        const normal = edge.perpendicular().normalize();

        const indexDistance = Math.abs((polygonVertexIndexMap[`${a.x}-${a.y}`] ?? 0) - (polygonVertexIndexMap[`${b.x}-${b.y}`] ?? 0));

        axes[i] = { normal, internal: indexDistance !== 1 };
    }

    if (!shape.center)
    {
        center.divide(axes.length);
        shape.center = center;
    }
    if (!shape.boundary)
    {
        shape.boundary = {
            x: minx,
            y: miny,
            w: maxx - minx,
            h: maxy - miny,
        };
    }

    return axes;
}

export function getCenter(polygon: Polygon): VectorValue | null {
    // If the polygon has a 'center' property, use it
    if ('center' in polygon && polygon.center)
    {
        return polygon.center as VectorValue;
    }
    // Otherwise compute from boundary (if available)
    if (polygon.boundary)
    {
        const b = polygon.boundary;
        return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    }
    // Fallback: average all vertices
    const verts = polygon.vertices;
    if (!verts || verts.length === 0) return null;
    let cx = 0, cy = 0;
    for (const v of verts)
    {
        cx += v.x;
        cy += v.y;
    }
    return { x: cx / verts.length, y: cy / verts.length };
}

export function getMTV(
    axes: Vector2[],
    shape1: VectorValue[],
    shape2: VectorValue[]
) {
    let minOverlap = Number.MAX_SAFE_INTEGER;
    let mtvAxis: Vector2 | null = null;

    for (const axis of axes)
    {
        const a = getProjection(axis, shape1);
        const b = getProjection(axis, shape2);

        if (!a.overlaps(b)) return false; // separating axis found

        const overlap = a.getOverlap(b);
        if (overlap < minOverlap)
        {
            minOverlap = overlap;
            mtvAxis = axis;
        }
    }

    return mtvAxis ? { overlap: minOverlap, axis: mtvAxis } : null;
}

// helper functions 
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