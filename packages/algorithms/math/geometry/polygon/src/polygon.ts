// import statements 

import { Rectangle } from "@papit/rectangle";
import { Decomposition, Triangulation } from "@papit/triangulation";
import { Vector2, VectorValue } from "@papit/vector";

class PolygonShape {
    private _boundary!: Rectangle;
    get boundary() {
        return {
            x: this._boundary.x + this._offset.x,
            y: this._boundary.y + this._offset.y,
            w: this._boundary.w,
            h: this._boundary.h,
        }
    }

    get vertices() {
        return this._vertices;
    }

    private _center!: Vector2;
    get center() {
        return Vector2.add(this._center, this._offset);
    }

    public triangles: number[] = []; // will be assigned by higher class 

    constructor(
        protected _vertices: Vector2[], // BY REFERENCE 
        protected _offset: Vector2, // BY REFERENCE 
    ) {
        this.calibrate();
    }

    public calibrate() {
        let center = Vector2.zero;
        let minx = Infinity;
        let maxx = -Infinity;
        let miny = Infinity;
        let maxy = -Infinity;

        for (const v of this._vertices)
        {
            center.add(v);
            if (v.x < minx) minx = v.x;
            if (v.x > maxx) maxx = v.x;
            if (v.y < miny) miny = v.y;
            if (v.y > maxy) maxy = v.y;
        }
        this._center = center;
        this._boundary = new Rectangle(minx, miny, maxx - minx, maxy - miny);
    }

    public getTriangle(index: number): [a: Vector2, b: Vector2, c: Vector2] {
        return [
            this.vertices[index * 3 + 0],
            this.vertices[index * 3 + 1],
            this.vertices[index * 3 + 2],
        ];
    }
}

export class Polygon extends PolygonShape {
    private _shapes: PolygonShape[] = [];
    private _shapesindeces: number[] = [];

    private _originalVertices: Vector2[] = [];
    private _dirty = false;
    public concave = false;

    override get vertices(): Vector2[] {
        if (this._dirty)
        {
            this.recomputeVertices();
        }
        return this._vertices;
    }

    get shapes(): PolygonShape[] {
        if (this._dirty)
        {
            this.recomputeVertices();
        }
        return this._shapes;
    }

    set vertices(vertices: VectorValue[]) {
        this._vertices = vertices.map(v => new Vector2(v));
        if (this._vertices.length >= 3)
        {
            this.calibrate();
            this.triangulate();
        }
    }

    constructor(...vertices: VectorValue[]) {
        super([], Vector2.zero);
        this.vertices = vertices;
    }

    public override calibrate() {

        this._dirty = false;
        this._originalVertices = [];
        this.concave = false;

        let convex = 0;
        let concave = 0;

        // calibrating
        for (let i = 0; i < this._vertices.length; i++)
        {
            const v = this._vertices[i];
            const prev = (i - 1 + this._vertices.length) % this._vertices.length;
            const next = (i + 1) % this._vertices.length;

            const AB = Vector2.subtract(v, this._vertices[prev]);
            const BC = Vector2.subtract(this._vertices[next], v);

            const crossproduct = Vector2.cross(AB, BC);

            if (crossproduct > 0)
            {
                convex++;
            }
            else if (crossproduct < 0)
            {
                concave++;
            }
            else
            {
                // its collinear
                this._vertices.splice(i, 1);
                i--;
                continue;
            }
        }

        if (concave > convex)
        {
            this._vertices = this._vertices.reverse();
            this._originalVertices = this._originalVertices.reverse();
        }

        this.concave = convex > 0 && concave > 0;
        this._originalVertices = this._vertices.map(v => v.clone);
        super.calibrate();
    }
    public triangulate() {
        this._shapes = [];
        this._shapesindeces = [];

        // call triangulation + decomposition to get indices and generate shapes 
        const triangulation = Triangulation(this);
        if (triangulation.error)
        {
            throw triangulation.error;
        }
        this.triangles = triangulation.triangles;

        const shapes = Decomposition(this);
        if (shapes.error)
        {
            throw shapes.error;
        }

        this._shapesindeces = shapes.shapes;

        let i = 0;
        while (i < this._shapesindeces.length)
        {
            const count = this._shapesindeces[i];
            if (count === 0) { i++; continue; }
            const vertices: Vector2[] = [];
            for (let j = i + 1; j <= i + count; j++)
            {
                vertices.push(this._vertices[this._shapesindeces[j]]);
            }
            if (vertices.length)
            {
                this._shapes.push(new PolygonShape(vertices, this._offset));
            }
            i += count + 1;
        }
    }

    public getShape(index: number) {
        if (this._dirty)
        {
            this.recomputeVertices();
        }

        return this._shapes.at(index);
    }

    public getVertex(index: number) {
        if (this._dirty)
        {
            this.recomputeVertices();
        }

        return this._vertices.at(index);
    }

    // coordination
    move(vector: VectorValue): void;
    move(x: number, y: number): void;
    public move(x: VectorValue, y?: number) {
        this._dirty = true;
        if (y !== undefined)
        {
            this._offset.add(x as number, y);
        }
        else 
        {
            this._offset.add(x);
        }
    }

    set(vector: VectorValue): void;
    set(x: number, y: number): void;
    public set(x: VectorValue, y?: number) {
        this._dirty = true;
        if (y !== undefined)
        {
            this._offset.x = x as number;
            this._offset.y = y;
        }
        else 
        {
            const v = new Vector2(x);
            this._offset.x = v.x
            this._offset.y = v.y;
        }
    }

    // private functions 

    private recomputeVertices() {
        this._vertices.forEach((v, i) => {
            v.x = this._originalVertices[i].x + this._offset.x;
            v.y = this._originalVertices[i].y + this._offset.y;
        });
        this._dirty = false;
    }
}
