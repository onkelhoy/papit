/**
 * @fileoverview DOM utility for calculating the cumulative offset of an element.
 *
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-13
 */

/**
 * Calculates the cumulative `top` and `left` offset of an element relative
 * to the document's origin (top-left corner).
 *
 * @details
 * - Iteratively traverses the DOM tree using `offsetParent`, summing `offsetTop` and `offsetLeft`
 *   until it reaches the root.
 * - Does not account for scroll position.
 *
 * @param element - The HTML element to measure.
 * @returns An object containing the cumulative `top` and `left` offset values in pixels.
 *
 * @example
 * ```ts
 * const pos = CumulativeOffset(myElement);
 * console.log(pos.top, pos.left); // e.g., 120, 340
 * ```
 *
 * @remarks
 * - If you need scroll-aware positions, combine `getBoundingClientRect()` with
 *   `window.scrollX` and `window.scrollY`.
 * - Fixed-position elements may yield different results.
 */
export function CumulativeOffset(element: HTMLElement) {
  let top = 0, left = 0;
  do {
    top += element.offsetTop || 0;
    left += element.offsetLeft || 0;
    element = element.offsetParent as HTMLElement;
  } while (element);

  return {
    top: top,
    left: left
  };
};