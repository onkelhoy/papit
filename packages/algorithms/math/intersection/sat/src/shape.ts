import type { VectorValue } from "@papit/vector";
import type { Polygon, Shape } from "types";

export function getShapes(polygon: Polygon): Shape[] {

    if (polygon.getShape)
    {
        const _shapes: Shape[] = [];
        let i = 0;
        while (true)
        {
            const shape = polygon.getShape(i);
            if (shape === null || shape === undefined || (Array.isArray(shape) && shape.length === 0)) break;

            if (Array.isArray(shape))
            {
                _shapes.push({ vertices: shape });
            }
            else 
            {
                _shapes.push(shape);
            }
            i++;
        }
        return _shapes;
    }

    if (polygon.shapes && polygon.shapes.length > 0)
    {
        const shapes = extractShapes(polygon, polygon.shapes);
        return shapes; // length check allows triangle to have a chance too
    }

    if (polygon.getTriangle)
    {
        // avoid checking in each triangle 
        const _shapes: Shape[] = [];
        let i = 0;
        while (true)
        {
            const vertices = polygon.getTriangle(i);
            if (vertices === null || vertices === undefined || vertices.length === 0 || vertices.at(0) === undefined) break;
            _shapes.push({ vertices });
            i++;
        }
        return _shapes;
    }

    if (polygon.triangles && polygon.triangles.length > 0)
    {
        const shapes: Shape[] = [];

        for (let i = 0; i < polygon.triangles.length / 3; i++)
        {
            const a = getVertex(polygon, i);
            const b = getVertex(polygon, i * 3 + 1);
            const c = getVertex(polygon, i * 3 + 2);

            if (a !== undefined && b !== undefined && c !== undefined)
                shapes.push({ vertices: [a, b, c] });
        }
        return shapes;
    }

    return [polygon]; // then we just give the whole polygon itself 
}

// util functions 
function isVectorValue(value: any): value is VectorValue {
    return value && typeof value === "object" && (
        'x' in value ||
        (Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number")
    );
}
function isShape(value: any): value is Shape {
    return value && typeof value === "object" && 'vertices' in value;
}
function getVertex(polygon: Polygon, index: number) {
    return typeof polygon.getVertex === "function" ? polygon.getVertex(index) : polygon.vertices[index];
}

// extraction functions 

function extractVectorValueWithBreakpoint(vertices: (VectorValue | any)[]) {
    const shapes: Shape[] = [];
    let current: Shape = { vertices: [] };
    for (const v of vertices)
    {
        if (isVectorValue(v))
        {
            current.vertices.push(v);
        }
        else 
        {
            // breakpoint 
            shapes.push(current);
            current = { vertices: [] };
        }
    }
    if (current.vertices.length > 0) shapes.push(current);
    return shapes;
}

function extractNestedArray(polygon: Polygon, groups: any[][]) {
    const shapes: Shape[] = [];
    let shape: Shape = { vertices: [] };
    for (const group of groups)
    {
        for (const vert of group)
        {
            if (isVectorValue(vert))
            {
                shape.vertices.push(vert);
            }
            else if (typeof vert === "number")
            {
                const v = getVertex(polygon, vert);
                if (v) shape.vertices.push(v);
            }
        }
        shapes.push(shape);
        shape = { vertices: [] };
    }

    return shapes;
}

function extractSizedIndices(polygon: Polygon, indices: number[]) {
    const shapes: Shape[] = [];
    for (let i = 0; i < indices.length; i++)
    {
        shapes.push({
            vertices: new Array(indices[i]).fill(0).map((_, j) => getVertex(polygon, indices[i + 1 + j])).filter(v => v !== undefined)
        });

        i += indices[i];
    }
    return shapes;
}

function extractShapes(polygon: Polygon, shapes: any[]) {
    const first = shapes[0];

    if (isVectorValue(first))
    {
        // then we assume [VectorValue, .., any, VectorValue, ..] where any is a breakpoint 
        return extractVectorValueWithBreakpoint(shapes)
    }

    if (isShape(first))
    {
        return shapes as Shape[];
    }

    if (Array.isArray(first))
    {
        return extractNestedArray(polygon, shapes);
    }

    // last case is number[] -> [(size), ...indices]
    if (typeof first === "number")
    {
        return extractSizedIndices(polygon, shapes);
    }

    return [];
}   
