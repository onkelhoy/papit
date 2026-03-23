/**
 * @fileoverview Utility function to recursively extract trimmed text values
 * from the leaf nodes of an HTML `<slot>` element.
 *
 * @example
 * ```ts
 * const slotValues = ExtractSlotValue(mySlot);
 * // Example output: ["Hello", "World"]
 * ```
 *
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-13
 */

/**
 * Extracts all non-empty, trimmed text content from the leaf nodes of a slot.
 *
 * @param slot - The HTML slot element to read from.
 * @returns An array of text values found within the slot’s assigned nodes.
 */
export function ExtractSlotValue(slot: HTMLSlotElement) {
  const nodes = slot.assignedNodes();

  const values: Array<string> = [];
  nodes.forEach(node => appendLeafValue(node, values))

  return values;
}

/**
 * Recursively traverses a DOM node tree and appends text from leaf nodes.
 *
 * @param node - The current node being inspected.
 * @param L - The accumulator array to store extracted text values.
 */
function appendLeafValue(node: Node, L: Array<string>) {
  if (node.hasChildNodes()) {
    node.childNodes.forEach(child => appendLeafValue(child, L));
  }
  else if (node.textContent) {
    if (node.textContent.trim() === "") return;
    L.push(node.textContent);
  }
}