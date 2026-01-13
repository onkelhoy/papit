import { Value } from "./types";

export function toArray(a: Value, ...rest: number[]): Float32Array | number[] {
    if (Array.isArray(a) || a instanceof Float32Array)
    {
        return a;
    }

    if (typeof a === "number")
    {
        if (rest.length === 0) 
        {
            return new Array(a).fill(0);
        }

        return [a, ...rest];
    }

    const { order, ...restValues } = a;

    if (order)
    {
        return order.map(key => a[key]);
    }

    return Object.values(restValues);
}