import { Vector2, VectorObject, VectorValue } from "@papit/vector";
import { CircleObject } from "./types";
import { Shape } from "component";

export class Circle extends Shape {

    public radius: number;

    constructor(vector: VectorValue, radius: number) {
        super(vector);

        this.radius = radius;
    }

    get r() {
        return this.radius;
    }

    set r(value: number) {
        this.radius = value;
    }

    get boundary() {
        return {
            x: this.x - this.r,
            y: this.y - this.r,
            w: this.r * 2,
            h: this.r * 2,
        };
    }
    supportFunction(direction: VectorObject) {
        const angle = Vector2.angle(direction);
        return this.add(Math.cos(angle) * this.r, Math.sin(angle) * this.r);
    }

    draw(ctx: CanvasRenderingContext2D, strokecolor = "black", fillcolor = "rgba(0,0,0,0.1)") {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.strokeStyle = strokecolor;
        ctx.fillStyle = fillcolor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fill();
        ctx.closePath();
    }

    static toCircle(value: VectorValue, r: number) {
        const c = new Circle(value, r);
        return c;
    }

    toString() {
        return String({ x: this.x, y: this.y, z: this.z, r: this.r });
    }
}