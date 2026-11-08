import type { Bounds } from "./types";

/**
 * Axis-aligned bounds of xyz `positions`, plus the radius of the sphere
 * around the origin that holds every vertex. Empty input gives zero bounds.
 */
export function bounds(positions: Float32Array): Bounds {
    if (positions.length < 3)
    {
        return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, radius: 0 };
    }

    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    let radiusSquared = 0;

    for (let i = 0; i + 2 < positions.length; i += 3)
    {
        const x = positions[i], y = positions[i + 1], z = positions[i + 2];
        if (x < min.x) min.x = x;
        if (y < min.y) min.y = y;
        if (z < min.z) min.z = z;
        if (x > max.x) max.x = x;
        if (y > max.y) max.y = y;
        if (z > max.z) max.z = z;
        const lengthSquared = x * x + y * y + z * z;
        if (lengthSquared > radiusSquared) radiusSquared = lengthSquared;
    }

    return { min, max, radius: Math.sqrt(radiusSquared) };
}
