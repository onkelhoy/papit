/** Writes `a * b` into `out` without allocating. `out` can't be `a` or `b`. All are column-major. */
export function multiplyInto(out: Float64Array, a: ArrayLike<number>, b: ArrayLike<number>) {
    for (let column = 0; column < 4; column++)
    {
        for (let row = 0; row < 4; row++)
        {
            out[column * 4 + row] =
                a[row] * b[column * 4]
                + a[4 + row] * b[column * 4 + 1]
                + a[8 + row] * b[column * 4 + 2]
                + a[12 + row] * b[column * 4 + 3];
        }
    }
}
