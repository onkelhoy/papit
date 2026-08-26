// exports
export * from "./triangulation";
export * from "./decomposition";
export * from "./calibrate";

// imports 
import { Polygon } from "@papit/polygon";
import { Triangulation } from "./triangulation";
import { Decomposition } from "./decomposition";
import { Calibrate } from "./calibrate";

export function Triangulate(polygon: Polygon, verbose = false): ([error: false] | [error: "triangulation" | "decomposition", message: string]) {
    Calibrate(polygon, verbose);

    const [t_error, t_error_message] = Triangulation(polygon);
    if (t_error)
    {
        if (verbose) console.log("triangulate error", t_error_message);
        return ["triangulation", t_error_message];
    }

    const [d_error, d_error_message] = Decomposition(polygon);
    if (d_error)
    {
        if (verbose) console.log("decomposition error", t_error_message);
        return ["decomposition", d_error_message];
    }

    return [false]
}