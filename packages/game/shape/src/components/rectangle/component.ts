import { Vector, Vector2, VectorValue, type VectorObject } from "@papit/vector";
import type { PolygonObject } from "components/polygon";
import type { RectangleObject } from "./types";
import { Shape } from "component";

export class Rectangle extends Shape implements RectangleObject {

    get topLeft() {
        return { x: this.x, y: this.y }
    }
    get topRight() {
        return { x: this.x + this.w, y: this.y }
    }
    get bottomLeft() {
        return { x: this.x, y: this.y + this.h }
    }
    get bottomRight() {
        return { x: this.x + this.w, y: this.y + this.h }
    }
    get center() {
        return { x: this.x + this.w / 2, y: this.y + this.h / 2 }
    }

    override get w() {
        return this[2];
    }
    override set w(value: number) {
        this[2] = value;
    }
    get h() {
        return this[3];
    };
    set h(value: number) {
        this[3] = value;
    }
    // get d() {
    //     return this[5] ?? 0;
    // };
    // set d(value: number) {
    //     this[5] = value;
    // }

    get width() {
        return this.w;
    }
    get height() {
        return this.h;
    }
    // get depth() {
    //     return this.d;
    // }

    set width(value: number) {
        this.w = value;
    }
    set height(value: number) {
        this.h = value;
    }
    // set depth(value: number) {
    //     this.d = value;
    // }

    get polygon(): PolygonObject {
        const vertices = [this.topLeft, this.topRight, this.bottomLeft, this.bottomRight];
        const triangles = [0, 1, 2, 2, 3, 1]; // two triangles
        return {
            boundary: this,
            boundaryindex: [0, 1, 2, 3],
            center: this.center,
            id: 1,
            vertices,
            triangles,
            getTriangle(i) {
                const start = i * 3;
                return [
                    vertices[triangles[start]],
                    vertices[triangles[start + 1]],
                    vertices[triangles[start + 2]]
                ];
            }
        };
    }

    get boundary() {
        return this;
    }
    supportFunction(direction: VectorValue) {
        return Vector.create({ x: this.x, y: this.y });
    }

    draw(ctx: CanvasRenderingContext2D, strokecolor = "black", fillcolor = "rgba(0,0,0,0.1)") {
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = strokecolor;
        ctx.stroke();
        if (fillcolor) 
        {
            ctx.fillStyle = fillcolor;
            ctx.fill();
        }
        ctx.closePath();
    }
}