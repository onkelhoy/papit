import { Vector, VectorValue, type VectorObject } from "@papit/vector";
import type { RectangleObject } from "./types";
import { Shape } from "component";

export class Rectangle extends Shape implements RectangleObject {
    get h() {
        return this[3];
    };
    set h(value: number) {
        this[3] = value;
    }
    override get w() {
        return this[2];
    }
    override set w(value: number) {
        this[2] = value;
    }

    get width() {
        return this.w;
    }
    get height() {
        return this.h;
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