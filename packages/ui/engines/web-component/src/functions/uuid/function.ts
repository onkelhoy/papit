/**
 * @fileoverview Generates a pseudo-random UUID (version 4).
 *
 * @details
 * - Produces a UUID in the format `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.
 * - Uses both `Date.getTime()` and, if available, `performance.now()` for
 *   higher-precision seeding.
 * - Not guaranteed to be cryptographically secure — use the Web Crypto API
 *   for security-sensitive UUIDs.
 *
 * @returns A UUID v4–formatted string.
 *
 * @example
 * ```ts
 * const id = generateUUID();
 * console.log(id); // "3b12f1df-5232-4f85-aeb1-9b1e2b6c5f23"
 * ```
 *
 * @remarks
 * This implementation is designed for general application-level uniqueness.
 * For UUIDs that must meet strict RFC 4122 randomness requirements,
 * use `crypto.randomUUID()` (available in modern browsers and Node.js 19+).
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc4122 RFC 4122}
 *
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-13
 */

export function generateUUID() {
  let d = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now(); //use high-precision timer if available
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}