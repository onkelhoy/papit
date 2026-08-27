// import statements 

import { Vector, Vector2, type VectorValue } from "@papit/vector";
import { RectangleObject } from "types";

export class Rectangle {
    public x: number = 0;
    public y: number = 0;
    public w: number = 0;
    public h: number = 0;

    get width() {
        return this.w;
    }
    get height() {
        return this.h;
    }

    constructor(rec: RectangleObject);
    constructor(size: number);
    constructor(x: number, y: number, w: number, h: number);
    constructor(...points: VectorValue[]);
    constructor(a: RectangleObject | VectorValue, ...rest: (number | VectorValue)[]) {
        if (typeof a === "number")
        {
            if (rest.length === 0)
            {
                this.square(a);
                return;
            }

            const [b, c, d] = rest;
            this.x = a;
            if (typeof b === "number") this.y = b;
            if (typeof c === "number") this.w = c;
            if (typeof d === "number") this.h = d;
            return;
        }

        if (rest.length !== 0)
        {
            if (rest.length === 1)
            {
                // two points
                this.twoPoint(a, rest[0]);
                return;
            }

            this.boundary(a, ...rest);
            return;
        }

        if (Array.isArray(a))
        {
            // one point since rest is empty 
            this.onePoint(a);
            return;
        }

        if (typeof a === "object")
        {
            this.rectangleObject(a as RectangleObject);
            return;
        }

        throw new Error("[rectangle] provided parameter construction is not supported")
    }

    private rectangleObject(a: RectangleObject) {
        this.x = a.x;
        this.y = a.y;
        this.w = 'w' in a ? a.w : a.width;
        this.h = 'h' in a ? a.h : a.height;
    }
    private onePoint(a: VectorValue) {
        const v = new Vector(a);
        this.x = v[0];
        this.y = v[1];
        this.w = v[2];
        this.h = v[3] ?? v[2];
    }
    private twoPoint(a: VectorValue, b: VectorValue) {
        const pointa = new Vector2(a);
        const pointb = new Vector2(b);
        this.x = pointa.x;
        this.y = pointa.y;
        this.w = pointb.x;
        this.h = pointb.y;
    }
    private square(size: number) {
        this.w = size;
        this.h = size;
    }
    private boundary(...points: VectorValue[]) {
        let minx = Infinity;
        let maxx = -Infinity;
        let miny = Infinity;
        let maxy = -Infinity;

        for (const v of points)
        {
            const vec = new Vector2(v);
            if (vec.x < minx) minx = vec.x;
            if (vec.x > maxx) maxx = vec.x;
            if (vec.y < miny) miny = vec.y;
            if (vec.y > maxy) maxy = vec.y;
        }

        this.x = minx;
        this.y = miny;
        this.w = maxx - minx;
        this.h = maxy - miny;
    }
}