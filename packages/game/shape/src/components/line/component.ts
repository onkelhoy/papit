import { Vector2, type VectorValue } from "@papit/vector";

// TODO extend Shape for GJK support
export class Line {
    a: Vector2;
    b!: Vector2;
    _direction!: Vector2;

    /**
     * 
     * @param {Vector2} a 
     * @param {Vector2} b 
     */
    constructor(a: VectorValue, b?: VectorValue) {
        this.a = new Vector2(a);
        if (b)
        {
            this.b = new Vector2(a);
            this._direction = Vector2.subtract(b, a);
        }
    }

    get direction() {
        return this._direction;
    }
    set direction(value: Vector2) {
        this._direction = value;
        this.b = Vector2.add(this.a, this._direction);
    }

    // draw(ctx: CanvasRenderingContext2D, color = "black", r = 1) {
    //   ctx.strokeStyle = color;
    //   this.a.drawDot(ctx, color, r * 5);

    //   let a: VectorValue = this.a;
    //   let b: VectorValue | undefined = undefined;

    //   if (this.b)
    //   {
    //     this.b.drawDot(ctx, color, r * 5);
    //     b = this.b;
    //   }
    //   else 
    //   {
    //     a = { x: this.a.x - this.direction.x * 10_000, y: this.a.y - this.direction.y * 10_000 }
    //     b = { x: this.a.x + this.direction.x * 10_000, y: this.a.y + this.direction.y * 10_000 }
    //   }

    //   ctx.lineWidth = r;
    //   ctx.beginPath();
    //   ctx.moveTo(a.x, a.y);
    //   ctx.lineTo(b.x, b.y);
    //   ctx.stroke();
    //   ctx.closePath();
    // }

    static DirectionLine(a: Vector2, direction: Vector2) {
        const l = new Line(a);
        l.direction = direction;

        return l;
    }
}