import { fnv1a, keyHash } from "../../hash";

/** Size of the identifier ring: ids and keys are 32-bit. */
export const RING = 2 ** 32;

export { fnv1a, keyHash };

/** Clockwise steps from `a` to `b`. */
export function distance(a: number, b: number) {
  return (b - a + RING) % RING;
}

/** `x` in the open interval (a, b) on the ring. `a === b` covers everything but `a`. */
export function between(x: number, a: number, b: number) {
  if (a === b) return x !== a;
  const d = distance(a, x);
  return d > 0 && d < distance(a, b);
}

/** `x` in (a, b] on the ring. `a === b` covers everything. */
export function upTo(x: number, a: number, b: number) {
  if (a === b) return true;
  const d = distance(a, x);
  return d > 0 && d <= distance(a, b);
}

/** Where finger `i` of the node at `h` starts: h + 2^i. */
export function fingerStart(h: number, i: number) {
  return (h + 2 ** i) % RING;
}
