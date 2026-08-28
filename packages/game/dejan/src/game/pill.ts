import { Vector2, VectorValue } from "@papit/vector";
import { Polygon } from "@papit/polygon";
import { DrawPolygon } from "@papit/game-shape";

export class Pill {
    private _polygon: Polygon;

    /**
     * Vertical capsule: two semicircle caps (radius = width/2) joined by
     * straight sides. `height` is the total height including both caps.
     */
    constructor(
        public readonly width: number,
        public readonly height: number,
        private segments = 8 // arc resolution per cap — higher = smoother, more edges
    ) {
        const vertices = Pill.buildVertices(width, height, segments);
        this._polygon = new Polygon(...vertices);
    }

    get center() {
        return this._polygon.center;
    }

    get boundary() {
        return this._polygon.boundary;
    }

    get polygon() {
        return this._polygon;
    }

    // position = the pill's center point
    update(position: VectorValue) {
        this._polygon.set(position);
    }

    draw(ctx: CanvasRenderingContext2D, strokecolor = "black") {
        DrawPolygon(this.polygon, ctx, { strokecolor });
    }

    // builds vertices centered at origin, walking the perimeter continuously
    // (top-right straight point -> arc over the top -> down the left side ->
    //  arc under the bottom -> back up the right side) — no jumps, no diagonals
    private static buildVertices(width: number, height: number, segments: number): Vector2[] {
        const radius = width / 2;
        const straightHalf = Math.max(height - width, 0) / 2;

        const topCenter = { x: 0, y: -straightHalf };
        const bottomCenter = { x: 0, y: straightHalf };

        const vertices: Vector2[] = [];

        // top cap: sweep from angle 0 (right) to -PI (left), over the top
        for (let i = 0; i <= segments; i++)
        {
            const angle = -Math.PI * (i / segments);
            vertices.push(new Vector2(
                topCenter.x + radius * Math.cos(angle),
                topCenter.y + radius * Math.sin(angle)
            ));
        }

        // bottom cap: sweep from angle PI (left) to 0 (right), under the bottom
        for (let i = 0; i <= segments; i++)
        {
            const angle = Math.PI - Math.PI * (i / segments);
            vertices.push(new Vector2(
                bottomCenter.x + radius * Math.cos(angle),
                bottomCenter.y + radius * Math.sin(angle)
            ));
        }

        return vertices;
    }
}