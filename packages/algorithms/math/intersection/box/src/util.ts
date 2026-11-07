import type { Rectangle } from "types";

type Size = "w" | "h" | "d";
const DIM_MAP = { w: "width", h: "height", d: "depth" };

/** Size of `rectangle` along `dim`, using the short or long name. 0 when missing. */
export function dim(rectangle: Rectangle, dim: Size): number {
    const r = rectangle as Record<string, number | undefined>;
    return r[dim] ?? r[DIM_MAP[dim]] ?? 0;
}

/** Whether `rectangle` is a 3D box (has a `z`). */
export function is3D(rectangle: Rectangle) {
    return rectangle.z !== undefined;
}
