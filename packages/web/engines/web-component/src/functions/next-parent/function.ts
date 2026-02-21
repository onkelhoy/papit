/**
 * @fileoverview DOM utility for retrieving the next parent of an element, 
 * including Shadow DOM host support.
 * 
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-13
 */

/**
 * Returns the parent element of a given DOM element.
 *
 * @details
 * - If `parentElement` exists, it is returned.
 * - If the element is inside a Shadow DOM, the shadow host is returned.
 * - Returns `null` if neither a parent nor a host is found.
 *
 * @typeParam T - The expected element type for the returned parent (default: `HTMLElement`).
 *
 * @param element - The DOM element whose parent is being retrieved.
 * @returns The parent element or shadow host, or `null` if none exists.
 *
 * @example
 * ```ts
 * const parent = nextParent(myElement);
 * if (parent) {
 *   console.log("Parent found:", parent.tagName);
 * }
 * ```
 *
 * @remarks
 * - Useful for navigating out of a Shadow DOM to the host element.
 * - If `T` is provided, you can get stronger type checks for the returned parent.
 */
export function nextParent<T = HTMLElement>(element: HTMLElement) {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  if (root) return (root as any).host as T;
  return null;
}