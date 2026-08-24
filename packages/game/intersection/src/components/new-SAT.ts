import { SimplePolygonObject } from "@papit/game-shape";
import { Vector2 } from "@papit/vector";

export function SAT(shape1: SimplePolygonObject, shape2: SimplePolygonObject) {
    let overlap = Number.MAX_SAFE_INTEGER;
    let axis: Vector2 | null = null;

    for (let i = 0; i < 2; i++)
    {
        const axes = getAxes(i === 0 ? shape1 : shape2);
        let mtv = getMTV(axes, shape1, shape2);
        if (mtv === false) return false;
        if (mtv !== null && mtv.overlap < overlap)
        {
            axis = mtv.axis;
            overlap = mtv.overlap;
        }
    }

    return { axis, overlap }
}

// helper 
class Projection {
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

function getAxes(shape: SimplePolygonObject) {
    const axes = new Array<Vector2>(shape.vertices.length);
    for (let i = 0; i < axes.length; i++)
    {
        const a = shape.vertices[i];
        const b = shape.vertices[(i + 1) === axes.length ? 0 : i + 1];
        const edge = Vector2.subtract(a, b);
        const normal = edge.perpendicular().normalize();
        axes[i] = normal;
    }

    return axes;
}

function getProjection(axis: Vector2, shape: SimplePolygonObject) {
    let min = axis.dot(shape.vertices[0]);
    let max = min;

    for (let i = 1; i < shape.vertices.length; i++) 
    {
        // NOTE: the axis must be normalized to get accurate projections
        const p = axis.dot(shape.vertices[i]);
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

function getMTV(
    axes: Vector2[],
    shape1: SimplePolygonObject,
    shape2: SimplePolygonObject
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