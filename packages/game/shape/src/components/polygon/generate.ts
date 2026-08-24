import { Pixel, Pixels } from "@papit/game-engine";
import { isPointInPolygonRayCasting } from "./intersection";
import { Polygon } from "./component";

export type Point = {
    x: number;
    y: number;
    key: string;
};

/**
 * Moore neighbourhood in clockwise order.
 *
 * Image coordinates:
 *        NW   N   NE
 *         7   0    1
 *         W   P    E
 *         6        2
 *        SW   S   SE
 *         5   4    3
 */
const MOORE_NEIGHBOURS = [
    { x: 0, y: -1 }, // 0 N
    { x: 1, y: -1 }, // 1 NE
    { x: 1, y: 0 },  // 2 E
    { x: 1, y: 1 },  // 3 SE
    { x: 0, y: 1 },  // 4 S
    { x: -1, y: 1 }, // 5 SW
    { x: -1, y: 0 }, // 6 W
    { x: -1, y: -1 }, // 7 NW
];

function key(x: number, y: number): string {
    return `${x}x${y}`;
}

function makePoint(x: number, y: number): Point {
    return {
        x,
        y,
        key: key(x, y),
    };
}

function isEmpty(pixel: Pixel | undefined): boolean {
    if (!pixel)
    {
        return true;
    }
    if (pixel.a === 0)
    {
        return true;
    }
    return pixel.r === 255 && pixel.g === 255 && pixel.b === 255;
}

function isFilled(pixels: Pixels, x: number, y: number): boolean {
    const pixel = pixels.get(x, y);
    return pixel !== undefined && !isEmpty(pixel);
}

function neighbourIndex(current: Point, neighbour: Point): number {
    const dx = neighbour.x - current.x;
    const dy = neighbour.y - current.y;
    return MOORE_NEIGHBOURS.findIndex((d) => d.x === dx && d.y === dy);
}

/**
 * Moore boundary tracing.
 *
 * `current` is the current boundary pixel.
 * `backtrack` is the pixel from which the neighbourhood search starts.
 *
 * Rule:
 *   WHITE: backtrack = candidate, continue searching clockwise
 *   FILLED: candidate becomes next boundary pixel, pixel before candidate becomes backtrack
 *
 * Termination: exact same (current, backtrack) state as start.
 */
function moore(start: Point, pixels: Pixels): Point[] {
    // Check if start has any foreground neighbour.
    let hasNeighbour = false;
    for (const direction of MOORE_NEIGHBOURS)
    {
        if (isFilled(pixels, start.x + direction.x, start.y + direction.y))
        {
            hasNeighbour = true;
            break;
        }
    }
    if (!hasNeighbour)
    {
        return [start];
    }

    const boundary: Point[] = [];
    // Raster scan finds first foreground pixel; west is natural initial backtrack.
    const initialBacktrack = makePoint(start.x - 1, start.y);

    let current = start;
    let backtrack = initialBacktrack;

    const initialState = {
        currentKey: current.key,
        backtrackKey: backtrack.key,
    };

    boundary.push(start);

    const maxIterations = Math.max(1024, pixels.width * pixels.height * 8);
    const states = new Set<string>();

    for (let iteration = 0; iteration < maxIterations; iteration++)
    {
        const stateKey = `${current.key}|${backtrack.key}`;

        // If we return to initial state after at least one transition, we're done.
        if (
            iteration > 0 &&
            current.key === initialState.currentKey &&
            backtrack.key === initialState.backtrackKey
        )
        {
            return boundary;
        }

        if (states.has(stateKey))
        {
            console.error("Moore tracer entered an unexpected cycle", {
                current,
                backtrack,
                start,
                boundaryLength: boundary.length,
                iteration,
            });
            throw new Error("Moore tracing entered an unexpected cycle");
        }
        states.add(stateKey);

        const backtrackIndex = neighbourIndex(current, backtrack);
        if (backtrackIndex === -1)
        {
            throw new Error(
                `Moore tracing: backtrack is not a neighbour of current. ` +
                `current=${current.key}, backtrack=${backtrack.key}`
            );
        }

        // Search clockwise starting immediately after backtrack.
        let found = false;
        let searchBacktrack = backtrack;

        for (let i = 1; i <= 8; i++)
        {
            const directionIndex = (backtrackIndex + i) % 8;
            const direction = MOORE_NEIGHBOURS[directionIndex];
            const candidate = makePoint(
                current.x + direction.x,
                current.y + direction.y
            );

            // Background pixel: move backtrack forward and continue.
            if (!isFilled(pixels, candidate.x, candidate.y))
            {
                searchBacktrack = candidate;
                continue;
            }

            // Next boundary pixel found.
            const next = candidate;
            const nextBacktrack = searchBacktrack;

            current = next;
            backtrack = nextBacktrack;

            if (current.key !== start.key)
            {
                boundary.push(current);
            }

            found = true;
            break;
        }

        if (!found)
        {
            // Should only happen for isolated pixel, already handled.
            return boundary;
        }
    }

    console.error("Moore tracing exceeded maximum iterations", {
        start,
        current,
        backtrack,
        boundaryLength: boundary.length,
        maxIterations,
    });
    throw new Error(`Moore tracing exceeded ${maxIterations} iterations`);
}

/**
 * Mark connected component (8‑connectivity) to avoid re‑tracing.
 * Used separately from Moore tracing.
 */
function markComponent(start: Point, pixels: Pixels, visited: Set<string>): void {
    const queue: Point[] = [start];
    visited.add(start.key);

    let index = 0;
    while (index < queue.length)
    {
        const current = queue[index++];
        for (const direction of MOORE_NEIGHBOURS)
        {
            const x = current.x + direction.x;
            const y = current.y + direction.y;
            const pixel = pixels.get(x, y);
            if (!pixel || isEmpty(pixel)) continue;

            const k = key(x, y);
            if (visited.has(k)) continue;

            visited.add(k);
            queue.push(makePoint(x, y));
        }
    }
}

/**
 * Remove collinear points from boundary (optional simplification).
 */
function simplifyBoundary(boundary: Point[]): Point[] {
    if (boundary.length <= 2) return boundary;

    const result: Point[] = [];
    const n = boundary.length;

    for (let i = 0; i < n; i++)
    {
        const previous = boundary[(i - 1 + n) % n];
        const current = boundary[i];
        const next = boundary[(i + 1) % n];

        const abx = current.x - previous.x;
        const aby = current.y - previous.y;
        const bcx = next.x - current.x;
        const bcy = next.y - current.y;

        // Cross product == 0 means collinear.
        const cross = abx * bcy - aby * bcx;
        if (cross !== 0)
        {
            result.push(current);
        }
    }

    if (result.length < 3) return boundary;
    return result;
}

/**
 * Generate polygons from an image.
 */
export async function GeneratePolygon(
    image: HTMLImageElement | string,
    scale = 1,
    noholes = true
): Promise<Polygon[]> {
    const pixels = await Pixels.FromImage(image);
    const polygons: Polygon[] = [];
    const visited = new Set<string>();

    for (let y = 0; y < pixels.height; y++)
    {
        for (let x = 0; x < pixels.width; x++)
        {
            const pixel = pixels.get(x, y);
            if (!pixel || isEmpty(pixel)) continue;

            const k = key(x, y);
            if (visited.has(k)) continue;

            const start = makePoint(x, y);

            // Trace boundary before marking component.
            let boundary = moore(start, pixels);

            // Mark entire connected component as visited.
            markComponent(start, pixels, visited);

            if (boundary.length < 3) continue;

            boundary = simplifyBoundary(boundary);
            if (boundary.length < 3) continue;

            // Optional hole filtering.
            if (noholes)
            {
                let inside = false;
                for (const polygon of polygons)
                {
                    if (isPointInPolygonRayCasting({ x: start.x, y: start.y }, polygon))
                    {
                        inside = true;
                        break;
                    }
                }
                if (inside) continue;
            }

            const polygon = new Polygon(...boundary.map((p) => ({ x: p.x * scale, y: p.y * scale })));
            polygons.push(polygon);
        }
    }

    return polygons;
}


// // import statements 
// import { Vector, VectorValue } from "@papit/vector";
// import { Pixel, Pixels } from "@papit/game-engine";

// import { isPointInPolygonRayCasting } from "./intersection";
// import { Polygon } from "./component";

// const MOORE_SET = [
//     { x: -1, y: -1 }, // NW
//     { x: 0, y: -1 }, // N
//     { x: 1, y: -1 }, // NE
//     { x: 1, y: 0 },  // E
//     { x: 1, y: 1 },  // SE
//     { x: 0, y: 1 },  // S
//     { x: -1, y: 1 },  // SW
//     { x: -1, y: 0 },  // W
// ];

// const DISTANCE_THRESHOLD = 2;
// const ANGLE_THRESHOLD = 0.01;

// export type Point = {
//     x: number;
//     y: number;
//     key: string;
// }

// // moore functions 
// function* moore_neighbour(c: Point, lastwhite: null | VectorValue) {
//     let s = 0;
//     if (lastwhite)
//     {
//         const d = Vector.subtract(lastwhite, c as unknown as VectorValue);
//         s = MOORE_SET.findIndex(a => a.x === d.x && a.y === d.y);
//         if (s == -1) s = 0;
//     }

//     for (let i = 0; i < 8; i++)
//     {
//         const direction = MOORE_SET[(s + i) % 8];
//         const v = Vector.add(c as unknown as VectorValue, direction);
//         yield {
//             x: v.x,
//             y: v.y,
//             key: key(v.x, v.y),
//         };
//     }
// }
// // function moore(s: Point, pixels: Pixels, visited: Record<string, boolean>) {
// //     const b: Point[] = [];
// //     let counter = 0;
// //     b.push(s);

// //     let prev = null;
// //     let p = s;
// //     let lastwhite = null;
// //     let N = moore_neighbour(p, { x: 0, y: 0 });
// //     let c = N.next().value as Point;

// //     while (c.key !== s.key)
// //     {

// //         counter++;
// //         if (counter > 10000)
// //         {
// //             console.error({ b, prev, p, lastwhite, N, c, s, visited, pixels })
// //             throw new Error("failed to construct polygon, counter too large");
// //         }
// //         visited[c.key] = true;
// //         const px = pixels.get(c.x, c.y);
// //         if (px && !isEmpty(px))
// //         { // this could be extended to only look for certain shape based on color

// //             if (prev)
// //             {
// //                 if (canAdd(b[b.length - 1] as unknown as VectorValue, prev as unknown as VectorValue, c as unknown as VectorValue))
// //                 {
// //                     b.push(prev);
// //                 }
// //             }

// //             prev = p;
// //             p = c;

// //             // if (canAdd(b[b.length - 1] as unknown as VectorValue, p as unknown as VectorValue, c as unknown as VectorValue)) 
// //             // {
// //             //     b.push(p);
// //             // }
// //             // prev = p;
// //             // p = c;
// //             N = moore_neighbour(p, lastwhite as unknown as VectorValue);
// //             c = N.next().value as Point;
// //         }
// //         else
// //         {
// //             lastwhite = c;
// //             c = N.next().value as Point;
// //         }
// //     }
// //     b.push(c); // last
// //     return Array.from(b.values());
// // }

// function moore(start: Point, pixels: Pixels) {
//     const boundary: Point[] = [start];

//     let p = start;

//     // Pixel from which we entered p.
//     let b: Point = {
//         x: start.x - 1,
//         y: start.y,
//         key: key(start.x - 1, start.y),
//     };

//     // The first boundary transition.
//     let firstP: Point | null = null;
//     let firstB: Point | null = null;

//     for (let counter = 0; counter < 10000; counter++)
//     {

//         const bIndex = MOORE_SET.findIndex(
//             d =>
//                 d.x === b.x - p.x &&
//                 d.y === b.y - p.y
//         );

//         if (bIndex === -1)
//         {
//             throw new Error(
//                 `Backtrack is not a Moore neighbour: ` +
//                 `p=${p.key}, b=${b.key}`
//             );
//         }

//         let found = false;

//         for (let i = 1; i <= 8; i++)
//         {

//             const direction =
//                 MOORE_SET[
//                 (bIndex + i) % 8
//                 ];

//             const x = p.x + direction.x;
//             const y = p.y + direction.y;

//             const candidate = pixels.get(x, y);

//             // White -> keep searching.
//             if (!candidate || isEmpty(candidate))
//             {
//                 continue;
//             }

//             // Black -> move to it.
//             const next: Point = {
//                 x,
//                 y,
//                 key: key(x, y),
//             };

//             const nextBacktrack = p;

//             // Remember the first transition.
//             if (!firstP)
//             {
//                 firstP = next;
//                 firstB = nextBacktrack;
//             }
//             else if (
//                 next.key === firstP.key &&
//                 nextBacktrack.key === firstB!.key
//             )
//             {
//                 return boundary;
//             }

//             b = nextBacktrack;
//             p = next;

//             boundary.push(p);

//             found = true;
//             break;
//         }

//         if (!found)
//         {
//             // Isolated pixel.
//             return boundary;
//         }
//     }

//     throw new Error(
//         "Moore tracing exceeded 10000 iterations"
//     );
// }

// function key(x: number, y: number) {
//     return `${x}x${y}`;
// }
// function isEmpty(pixel: Pixel) {
//     if (pixel.a === 0) return true;
//     return pixel.r === 255 && pixel.g === 255 && pixel.b === 255;
// }
// // function canAdd(a: VectorValue, b: VectorValue, c: VectorValue) {
// //     const distance = Vector.distance(a, c);
// //     if (distance < DISTANCE_THRESHOLD) return false;

// //     const AB = Vector.subtract(a, b);
// //     const BC = Vector.subtract(b, c);

// //     const dot = AB.dot(BC);
// //     const mag1 = AB.magnitude;
// //     const mag2 = BC.magnitude;

// //     const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));

// //     return angle >= ANGLE_THRESHOLD;
// // }

// export async function GeneratePolygon(image: HTMLImageElement | string, noholes = true) {
//     const pixels = await Pixels.FromImage(image);
//     const polygons: Polygon[] = [];
//     const visited: Record<string, boolean> = {};

//     for (let y = 0; y < pixels.imageData.height; y++)
//     {
//         let prev = false; // previous pixel holding state of empty 
//         for (let x = 0; x < pixels.imageData.width; x++)
//         {
//             const pixel = pixels.get(x, y);

//             if (!pixel || isEmpty(pixel))
//             {
//                 prev = false;
//                 continue;
//             }

//             const k = key(x, y);
//             if (visited[k]) continue;
//             visited[k] = true;

//             // we only interessted when previous pixel is empty and current is not, 
//             // not when both previous and current is filled then we are in middle of a shape
//             if (prev) continue;
//             prev = true;

//             if (noholes)
//             {
//                 // "safe check" - prevents holes however.. 
//                 let found = false;
//                 for (let pol of polygons)
//                 {
//                     if (isPointInPolygonRayCasting({ x, y }, pol))
//                     {
//                         found = true;
//                         break;
//                     }
//                 }
//                 if (found) continue;
//             }

//             // const boundary = moore({ x, y, key: k }, pixels) as unknown as VectorValue[];
//             // const p = new Polygon(...boundary)

//             const boundary = moore(
//                 { x, y, key: k },
//                 pixels
//             );

//             const p = new Polygon(
//                 ...boundary.map(point => ({
//                     x: point.x,
//                     y: point.y,
//                 }))
//             );

//             // we should cleanup the boundary
//             polygons.push(p);
//         }
//     }

//     return polygons;
// }

// // export async function GeneratePolygon(image: HTMLImageElement | string, noholes = true) {
// //     const pixels = await Pixels.FromImage(image);
// //     const polygons: Polygon[] = [];
// //     const visited: Record<string, boolean> = {};

// //     for (let y = 0; y < pixels.imageData.height; y++)
// //     {
// //         let prev = false; // previous pixel holding state of empty 
// //         for (let x = 0; x < pixels.imageData.width; x++)
// //         {
// //             const pixel = pixels.get(x, y);

// //             if (!pixel || isEmpty(pixel))
// //             {
// //                 prev = false;
// //                 continue;
// //             }

// //             const k = key(x, y);
// //             if (visited[k]) continue;
// //             visited[k] = true;

// //             // we only interessted when previous pixel is empty and current is not, 
// //             // not when both previous and current is filled then we are in middle of a shape
// //             if (prev) continue;
// //             prev = true;

// //             if (noholes)
// //             {
// //                 // "safe check" - prevents holes however.. 
// //                 let found = false;
// //                 for (let pol of polygons)
// //                 {
// //                     if (isPointInPolygonRayCasting({ x, y }, pol))
// //                     {
// //                         found = true;
// //                         break;
// //                     }
// //                 }
// //                 if (found) continue;
// //             }

// //             const boundary = moore({ x, y, key: k }, pixels) as unknown as VectorValue[];
// //             const p = new Polygon(...boundary)

// //             // we should cleanup the boundary
// //             polygons.push(p);
// //         }
// //     }

// //     return polygons;
// // }