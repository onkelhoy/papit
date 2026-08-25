import type { Rectangle } from "types";

const DIM_MAP = { w: "width", h: "height" };
export function dim(rectangle: Rectangle, dim: "w" | "h") {
    if (dim in rectangle) return rectangle[dim as keyof Rectangle];
    return rectangle[DIM_MAP[dim] as keyof Rectangle]
}
