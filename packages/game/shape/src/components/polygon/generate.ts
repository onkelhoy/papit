// import statements 
import { Vector, VectorValue } from "@papit/vector";
import { isPointInPolygonRayCasting } from "./intersection";
import { Polygon } from "./component";

const MOORE_SET = [
    { x: -1, y: -1 }, // NW
    { x: 0, y: -1 }, // N
    { x: 1, y: -1 }, // NE
    { x: 1, y: 0 },  // E
    { x: 1, y: 1 },  // SE
    { x: 0, y: 1 },  // S
    { x: -1, y: 1 },  // SW
    { x: -1, y: 0 },  // W
];

const DISTANCE_THRESHOLD = 2;
const ANGLE_THRESHOLD = 0.01;

export type Point = {
    x: number;
    y: number;
    key: string;
}

export type Pixel = {
    outofbounds: boolean;
    index?: number;
    r: number;
    g: number;
    b: number;
    a: number;
}

// moore functions 
function* moore_neighbour(c: Point, lastwhite: null | VectorValue) {
    let s = 0;
    if (lastwhite)
    {
        const d = Vector.subtract(lastwhite, c as unknown as VectorValue);
        s = MOORE_SET.findIndex(a => a.x === d.x && a.y === d.y);
        if (s == -1) s = 0;
    }

    for (let i = 0; i < 8; i++)
    {
        const direction = MOORE_SET[(s + i) % 8];
        const v = Vector.add(c as unknown as VectorValue, direction);
        yield {
            x: v.x,
            y: v.y,
            key: key(v.x, v.y),
        };
    }
}
function moore(s: Point, imageData: ImageData, visited: Record<string, boolean>) {
    const b: Point[] = [];
    let counter = 0;
    b.push(s);

    let prev = null;
    let p = s;
    let lastwhite = null;
    let N = moore_neighbour(p, { x: 0, y: 0 });
    let c = N.next().value as Point;

    while (c.key !== s.key)
    {
        counter++;
        if (counter > 10000)
        {
            console.log("EPIC FAIL", b)
            return b;
        }
        visited[c.key] = true;
        const px = pixel(c.x, c.y, imageData);
        if (!isEmpty(px))
        { // this could be extended to only look for certain shape based on color

            if (prev)
            {
                if (canAdd(b[b.length - 1] as unknown as VectorValue, prev as unknown as VectorValue, c as unknown as VectorValue))
                {
                    b.push(prev);
                }
            }

            prev = p;
            p = c;
            N = moore_neighbour(p, lastwhite as unknown as VectorValue);
            c = N.next().value as Point;
        }
        else
        {
            lastwhite = c;
            c = N.next().value as Point;
        }
    }
    b.push(c); // last
    return Array.from(b.values());
}
function key(x: number, y: number) {
    return `${x}x${y}`;
}
function isEmpty(pixel: Pixel) {
    if (pixel.outofbounds) return true;
    return pixel.r === 255 && pixel.g === 255 && pixel.b === 255;
}
function canAdd(a: VectorValue, b: VectorValue, c: VectorValue) {
    const distance = Vector.distance(a, c);
    if (distance < DISTANCE_THRESHOLD) return false;

    const AB = Vector.subtract(a, b);
    const BC = Vector.subtract(b, c);

    const dot = AB.dot(BC);
    const mag1 = AB.magnitude;
    const mag2 = BC.magnitude;

    const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));

    return angle >= ANGLE_THRESHOLD;
}
function getPixelAtIndex(i: number, imageData: ImageData): Pixel {
    return {
        outofbounds: false,
        index: i,
        r: imageData.data[i],
        g: imageData.data[i + 1],
        b: imageData.data[i + 2],
        a: imageData.data[i + 3],
    }
}
function pixel(x: number, y: number, imageData: ImageData): Pixel {
    if (x < 0 || y < 0 || x >= imageData.height || y >= imageData.width)
    {
        return {
            outofbounds: true,
            r: 0,
            g: 255,
            b: 255,
            a: 255,
        }
    }

    const index = y * imageData.width + x;
    return getPixelAtIndex(index * 4, imageData); // rgba
}

export function GeneratePolygon(ctx: CanvasRenderingContext2D, width: number, height: number, noholes = true) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const polygons: Polygon[] = [];
    const visited: Record<string, boolean> = {};

    for (let y = 0; y < imageData.height; y++)
    {
        let prev = false; // previous pixel holding state of empty 
        for (let x = 0; x < imageData.width; x++)
        {
            if (isEmpty(pixel(x, y, imageData)))
            {
                prev = false;
                continue;
            }

            const k = key(x, y);
            if (visited[k]) continue;
            visited[k] = true;

            // we only interessted when previous pixel is empty and current is not, 
            // not when both previous and current is filled then we are in middle of a shape
            if (prev) continue;
            prev = true;

            if (noholes)
            {
                // "safe check" - prevents holes however.. 
                let found = false;
                for (let pol of polygons)
                {
                    if (isPointInPolygonRayCasting({ x, y }, pol))
                    {
                        found = true;
                        break;
                    }
                }
                if (found) continue;
            }

            const boundary = moore({ x, y, key: key(x, y) }, imageData, visited) as unknown as VectorValue[];
            const p = new Polygon(...boundary)
            // console.log('boundary', boundary, p.verticies)
            // we should cleanup the boundary
            polygons.push(p);
        }
    }

    return polygons;
}