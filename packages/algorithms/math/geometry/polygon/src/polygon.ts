// import statements 

import { Triangulate } from "@papit/triangulation";
import { Vector2, VectorValue } from "@papit/vector";

export class Polygon {

    private _vertices: VectorValue[];
    private _verticesOffset: VectorValue[];
    private _dirty_verts = true;
    private _dirty_shapes = true;
    private _offset: VectorValue;
    private _center: VectorValue;

    public concave = false;

    get center() {
        return Vector2.add(this._center, this._offset);
    }
    private _shapes: Vector2[][];
    get shapes(): Vector2[][] {
        if (this._dirty_shapes)
        {
            return this.rebuildShapes();
        }

        return this._shapes;
    }
    private _shapesindeces: number[] = [];
    get shapesindeces() {
        return this._shapesindeces;
    }
    set shapesindeces(indices: number[]) {
        this._shapesindeces = indices;   // assign to backing field
        this._dirty_shapes = true; // let the next .shapes read rebuild it lazily
    }
    get boundary() {
        if (!this.boundaryindex) this.recalculate();
        if (!this.boundaryindex)
        {
            throw new Error("polygon has no boundary-index, attempt of recalucating has been made but no success");
        }

        return {
            x: this.getVertex(this.boundaryindex[0]).x,
            y: this.getVertex(this.boundaryindex[1]).y,
            w: this.getVertex(this.boundaryindex[2]).x - this.getVertex(this.boundaryindex[0]).x,
            h: this.getVertex(this.boundaryindex[3]).y - this.getVertex(this.boundaryindex[1]).y,
        }
    }
    get vertices() {
        if (this._dirty_verts)
        {
            this._dirty_verts = false;
            this._verticesOffset = this._vertices.map(v => Vector2.add(v, this._offset));
        }
        return this._verticesOffset; // one can mutate here 
    }
    set vertices(value: VectorValue[]) {
        this._vertices = value.map(v => new Vector2(v));
        this._verticesOffset = value.map(v => new Vector2(v)); // clone it 
        this._dirty_verts = false;
        this.recalculate();
    }
    triangles: number[];

    boundaryindex: number[];
    calibrated = false;

    private rebuildShapes() {
        this._shapes = [];
        this._dirty_shapes = false;
        let i = 0;
        while (i < this._shapesindeces.length)
        {
            const count = this._shapesindeces[i];
            if (count === 0) { i++; continue; }
            const shape: Vector2[] = [];
            for (let j = i + 1; j <= i + count; j++)
            {
                shape.push(this.getVertex(this._shapesindeces[j]));
            }
            if (shape.length) this._shapes.push(shape);
            i += count + 1;
        }

        return this.shapes;
    }

    constructor(...vertices: VectorValue[]) {
        this._verticesOffset = [];
        this._vertices = vertices;
        this._shapes = [];
        this._offset = Vector2.zero;
        this._center = Vector2.zero;
        this.triangles = [];
        this.boundaryindex = [];

        this.recalculate();
    }

    recalculate(verbose = false) {
        Triangulate(this, verbose);
        const center = Vector2.zero;
        this._vertices.forEach(vertex => center.add(vertex));
        center.divide(this._vertices.length);
        this._center = center;
        return this;
    }

    getVertex(i: number) {
        const v = this.vertices[i];
        if (!v) throw new Error(`no vertex at: ${i}`);
        if (!(v instanceof Vector2))
        {
            this.vertices[i] = new Vector2(v);
        }
        return v as Vector2;
    }

    getTriangle(i: number): [a: Vector2, b: Vector2, c: Vector2] {
        if (this.triangles.length === 0)
        {
            this.recalculate();
        }

        const a = this.triangles[i * 3];
        if (a === undefined) throw new Error("triangle does not exist");
        const b = this.triangles[i * 3 + 1];
        if (b === undefined) throw new Error("triangle does not exist");
        const c = this.triangles[i * 3 + 2];
        if (c === undefined) throw new Error("triangle does not exist");

        return [this.getVertex(a), this.getVertex(b), this.getVertex(c)];
    }

    getEdge(i: number): [a: Vector2, b: Vector2] {
        return [this.getVertex(i), this.getVertex((i + 1) % this.vertices.length)]
    }

    // transformations 
    move(x: number, y: number) {
        this._dirty_verts = true;
        this._dirty_shapes = true;
        this._offset = Vector2.add(this._offset, { x, y });
    }
    set(x: number, y: number) {
        this._dirty_verts = true;
        this._dirty_shapes = true;
        this._offset = new Vector2(x, y);
    }
}