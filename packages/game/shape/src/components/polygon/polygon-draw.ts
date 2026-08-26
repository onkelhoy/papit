import { Vector2, VectorValue } from "@papit/vector";
// import { Calibrate, Triangulate } from "@papit/triangulation";
import { Polygon } from "@papit/polygon";

type Setting = {
    strokecolor: string;
    fillcolor: string;
    r: number;
    boundary: boolean;
    triangles: boolean;
    shapes: boolean;
}
const defaultSettings: Setting = {
    strokecolor: "black",
    fillcolor: "rgba(0,0,0,0.1)",
    r: 1,
    triangles: false,
    boundary: true,
    shapes: true,
}
export function DrawPolygon(
    polygon: Polygon,
    ctx: CanvasRenderingContext2D,
    setting?: Partial<Setting>,
) {
    const {
        strokecolor,
        fillcolor,
        r,
        triangles,
        shapes,
    } = { ...defaultSettings, ...(setting ?? {}) };

    ctx.strokeStyle = strokecolor;

    polygon.vertices.forEach((_, i) => {
        const v = polygon.getVertex(i);
        ctx.beginPath();
        ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = strokecolor;
        ctx.fillStyle = fillcolor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fill();
        ctx.closePath();

        ctx.fillText(String(i), v.x, v.y - 10);
    });

    const c = polygon.center;

    ctx.lineWidth = r / 2;
    ctx.setLineDash([10, 15]);

    if (triangles)
    {
        for (let i = 0; i < polygon.triangles.length; i++)
        {
            const [a, b, c] = polygon.getTriangle(i);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(a.x, a.y);
            ctx.stroke();
            ctx.closePath();
        }
    }

    if (shapes) 
    {
        // ctx.strokeStyle = "blue";
        ctx.setLineDash([5, 8]);
        for (const shape of polygon.shapes)
        {
            ctx.beginPath();
            for (let i = 0; i < shape.length; i++)
            {
                const v = shape[i];
                if (i === 0) ctx.moveTo(v.x, v.y);
                else ctx.lineTo(v.x, v.y);
            }
            ctx.closePath(); // closePath already draws the return edge back to the start
            ctx.stroke();    // stroke once, after the path is complete
        }
    }

    ctx.setLineDash([]);
    ctx.lineWidth = r;
    // if (polygon.vertices.length > 1)
    // {
    //     ctx.beginPath();
    //     for (let i = 0; i < polygon.vertices.length; i++)
    //     {
    //         const vertex = polygon.getVertex(i);
    //         if (i === 0)
    //         {
    //             ctx.moveTo(vertex.x, vertex.y);
    //         }
    //         else 
    //         {
    //             ctx.lineTo(vertex.x, vertex.y);
    //         }
    //     }

    //     const firstVertex = polygon.getVertex(0);
    //     ctx.lineTo(firstVertex.x, firstVertex.y);

    //     ctx.stroke();
    //     ctx.fillStyle = fillcolor;
    //     ctx.fill();
    //     ctx.closePath();

    const boundary = polygon.boundary;
    if (boundary)
    {
        ctx.beginPath();
        ctx.lineWidth = r / 2;
        ctx.setLineDash([10, 15]);
        ctx.rect(boundary.x, boundary.y, boundary.w, boundary.h);
        ctx.stroke();
        ctx.closePath();
    }
    // }
}
// export class Polygon {

//     static instances = 0;
//     vertices: Vector2[];
//     convex: number[] = [];
//     triangles: number[];
//     boundaryindex: null | number[];
//     concave?: boolean;
//     id: number;
//     centeroffset?: Vector2;
//     changed = false;
//     calibrated = false;

//     constructor(...vertices: VectorValue[]) {
//         // super(0, 0, 0); 

//         this.vertices = [];
//         this.triangles = [];
//         this.boundaryindex = null;
//         this.id = Polygon.instances++;
//         this.vertices = vertices.map(v => new Vector2(v));

//         if (this.vertices.length > 0)
//         {
//             this.recalculate();
//         }
//     }

//     get boundary() {
//         if (!this.boundaryindex) this.recalculate();
//         if (!this.boundaryindex)
//         {
//             throw new Error("polygon has no boundary-index, attempt of recalucating has been made but no success");
//         }

//         return {
//             x: this.vertices[this.boundaryindex[0]].x,
//             y: this.vertices[this.boundaryindex[1]].y,
//             w: this.vertices[this.boundaryindex[2]].x - this.vertices[this.boundaryindex[0]].x,
//             h: this.vertices[this.boundaryindex[3]].y - this.vertices[this.boundaryindex[1]].y,
//         }
//     }
//     supportFunction(direction: VectorValue) {
//         // TODO fix me to return the furtherst away point nearest to the direction based on center (in a smart way)
//         return {
//             x: 0,
//             y: 0,
//             z: 0,
//         }
//     }

//     get x() {
//         if (this.vertices.length === 0) throw new Error("could not set x of empty polygon");
//         return this.vertices[0].x;
//     }
//     get y() {
//         if (this.vertices.length === 0) throw new Error("could not set y of empty polygon");
//         return this.vertices[0].y;
//     }
//     set x(value) {
//         this.debouncedmove(value, this.y);
//     }
//     set y(value) {
//         this.debouncedmove(this.x, value);
//     }

//     get center() {
//         if (!this.centeroffset)
//         {
//             return Vector2.zero;
//         }

//         return this.centeroffset.clone.add(this.vertices[0]);
//     }

//     private debouncedmove(x: VectorValue, y?: number) {

//     }

//     move(x: VectorValue, y?: number) {

//     }

//     recalculate(verbose = false) {
//         Triangulate(this, verbose);
//     }

//     getTriangle(i: number) {
//         return [
//             this.vertices[this.triangles[i * 3]],
//             this.vertices[this.triangles[i * 3 + 1]],
//             this.vertices[this.triangles[i * 3 + 2]],
//         ]
//     }
//     getTriangles() {
//         const triangles = [];
//         for (let i = 0; i < (this.triangles.length / 3); i++)
//         {
//             triangles.push(this.getTriangle(i));
//         }

//         return triangles;
//     }
//     draw(ctx: CanvasRenderingContext2D, strokecolor = "black", fillcolor = "rgba(0,0,0,0.1)", r = 1) {
//         ctx.strokeStyle = strokecolor;

//         this.vertices.forEach((v, i) => {

//             ctx.beginPath();
//             ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
//             ctx.strokeStyle = strokecolor;
//             ctx.fillStyle = fillcolor;
//             ctx.lineWidth = 1;
//             ctx.stroke();
//             ctx.fill();
//             ctx.closePath();

//             ctx.fillText(String(i), v.x, v.y - 10);
//         });

//         const c = this.center;
//         ctx.fillText(String(this.id), c.x, c.y);

//         ctx.lineWidth = r / 2;
//         ctx.setLineDash([10, 15]);
//         for (let i = 0; i < this.triangles.length; i += 3)
//         {
//             const a = this.vertices[this.triangles[i]];
//             const b = this.vertices[this.triangles[i + 1]];
//             const c = this.vertices[this.triangles[i + 2]];

//             ctx.beginPath();
//             ctx.moveTo(a.x, a.y);
//             ctx.lineTo(b.x, b.y);
//             ctx.lineTo(c.x, c.y);
//             ctx.lineTo(a.x, a.y);
//             ctx.stroke();
//             ctx.closePath();
//         }

//         ctx.setLineDash([]);
//         ctx.lineWidth = r;
//         if (this.vertices.length > 1)
//         {
//             ctx.beginPath();
//             for (let i = 0; i < this.vertices.length; i++)
//             {
//                 if (i === 0)
//                 {
//                     ctx.moveTo(this.vertices[i].x, this.vertices[i].y);
//                 }
//                 else 
//                 {
//                     ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
//                 }
//             }

//             ctx.lineTo(this.vertices[0].x, this.vertices[0].y);

//             ctx.stroke();
//             ctx.fillStyle = fillcolor;
//             ctx.fill();
//             ctx.closePath();

//             const boundary = this.boundary;
//             if (boundary)
//             {
//                 ctx.beginPath();
//                 ctx.lineWidth = r / 2;
//                 ctx.setLineDash([10, 15]);
//                 ctx.rect(boundary.x, boundary.y, boundary.w, boundary.h);
//                 ctx.stroke();
//                 ctx.closePath();
//             }
//         }
//     }
// }