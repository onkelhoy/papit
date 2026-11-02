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
    boundary: false,
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
        boundary,
        triangles,
        shapes,
    } = { ...defaultSettings, ...(setting ?? {}) };

    ctx.strokeStyle = strokecolor;

    polygon.vertices.forEach((v, i) => {
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
        for (let i = 0; i < polygon.triangles.length / 3; i++)
        {
            const triangle = polygon.getTriangle(i);
            if (!triangle) continue;
            const [a, b, c] = triangle;
            if (!a || !b || !c) continue;

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
        ctx.setLineDash([5, 8]);
        for (const shape of polygon.shapes)
        {
            ctx.beginPath();
            for (let i = 0; i < shape.vertices.length; i++)
            {
                const v = shape.vertices[i];
                if (i === 0) ctx.moveTo(v.x, v.y);
                else ctx.lineTo(v.x, v.y);
            }
            ctx.closePath(); // closePath already draws the return edge back to the start
            ctx.stroke();    // stroke once, after the path is complete
        }
    }

    ctx.setLineDash([]);
    ctx.lineWidth = r;
    if (polygon.vertices.length > 1)
    {
        ctx.beginPath();
        for (let i = 0; i < polygon.vertices.length; i++)
        {
            const vertex = polygon.getVertex(i);
            if (!vertex) continue;

            if (i === 0)
            {
                ctx.moveTo(vertex.x, vertex.y);
            }
            else 
            {
                ctx.lineTo(vertex.x, vertex.y);
            }
        }

        const firstVertex = polygon.getVertex(0);
        if (firstVertex)
        {
            ctx.lineTo(firstVertex.x, firstVertex.y);
        }

        ctx.stroke();
        ctx.fillStyle = fillcolor;
        ctx.fill();
        ctx.closePath();

        if (boundary && polygon.boundary)
        {
            ctx.beginPath();
            ctx.lineWidth = r / 2;
            ctx.setLineDash([10, 15]);
            ctx.rect(polygon.boundary.x, polygon.boundary.y, polygon.boundary.w, polygon.boundary.h);
            ctx.stroke();
            ctx.closePath();
        }
    }
}