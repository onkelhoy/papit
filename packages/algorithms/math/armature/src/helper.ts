import { Vector3 } from "@papit/vector";
import type { Point } from "./types";

/** Copies a point into `out`, a missing z becomes 0. */
export function setPoint(out: Vector3, point: Point) {
    out[0] = point[0];
    out[1] = point[1];
    out[2] = point[2] ?? 0;
    return out;
}
