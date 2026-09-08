import { Polygon } from "@papit/polygon";
import { Pixels } from "@papit/game-engine";
import { isPointInPolygonRayCasting } from "@papit/polygon-intersection"
import {
    Anchor,
    Point,
    MOORE_NEIGHBOURS,
    key,
    makePoint,
    isEmpty,
    isFilled,
    neighbourIndex,
    toVertices,
} from "./util";

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

            if (!isFilled(pixels, candidate.x, candidate.y))
            {
                searchBacktrack = candidate;
                continue;
            }

            const next = candidate;
            const nextBacktrack = searchBacktrack;

            current = next;
            backtrack = nextBacktrack;

            if (current.key !== start.key || backtrack.key !== initialBacktrack.key)
            {
                boundary.push(current);
            }

            found = true;
            break;
        }

        if (!found)
        {
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
 * Mark connected component (8-connectivity) to avoid re-tracing.
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
 * Remove collinear points from a closed vertex loop.
 */
function simplifyBoundary<T extends { x: number; y: number }>(boundary: T[]): T[] {
    if (boundary.length <= 2) return boundary;

    const result: T[] = [];
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

        const cross = abx * bcy - aby * bcx;
        if (cross !== 0)
        {
            result.push(current);
        }
    }

    if (result.length < 3) return boundary;
    return result;
}

export async function MooreNeighborhood(
    image: HTMLImageElement | string,
    scale = 1,
    noholes = true,
    anchor: Anchor = "auto"
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
            const rawBoundary = moore(start, pixels);
            markComponent(start, pixels, visited);

            if (rawBoundary.length < 3) continue;

            let vertices = toVertices(rawBoundary, anchor);
            vertices = simplifyBoundary(vertices);
            if (vertices.length < 3) continue;

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

            const polygon = new Polygon(...vertices.map((p) => ({ x: p.x * scale, y: p.y * scale })));
            polygons.push(polygon);
        }
    }

    return polygons;
}
