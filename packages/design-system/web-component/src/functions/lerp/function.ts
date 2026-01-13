/**
 * @fileoverview Linear interpolation utilities for mapping values between ranges.
 *
 * @details
 * - `lerp(a, b, t)`: Computes a value between `a` and `b` given a normalized factor `t` in [0, 1].
 * - `lerpValue(value, min, max, newmin, newmax)`: Maps a value from one range to another
 *   using linear interpolation, clamping the result to the target range.
 *
 * @example
 * ```ts
 * lerp(0, 10, 0.5); // 5
 *
 * lerpValue(5, 0, 10, 0, 100);  // 50
 * lerpValue(15, 0, 10, 0, 100); // 100 (clamped)
 * ```
 *
 * @remarks
 * `lerpValue` will clamp results to `[newmin, newmax]` to avoid exceeding the target range.
 * If you need unclamped mapping, you can remove the `Math.min`/`Math.max` calls.
 *
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-13
 */

/**
 * Performs a linear interpolation between two values.
 *
 * @param a - The starting value.
 * @param b - The ending value.
 * @param t - Interpolation factor, typically between `0` and `1`.
 * @returns The interpolated value between `a` and `b`.
 */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Maps a value from one range to another using linear interpolation.
 *
 * @param value - The value to map.
 * @param min - The lower bound of the original range.
 * @param max - The upper bound of the original range.
 * @param newmin - The lower bound of the target range.
 * @param newmax - The upper bound of the target range.
 * @returns The mapped value, clamped to `[newmin, newmax]`.
 */
export function lerpValue(value: number, min: number, max: number, newmin: number, newmax: number) {
  // Normalize 'value' to a [0, 1] range
  const t = (value - min) / (max - min);
  // Interpolate this normalized value to the new range
  return Math.min(newmax, Math.max(lerp(newmin, newmax, t), newmin));
}