import { Part, PartHelpers } from "../types";

/**
 * @fileoverview Manages a dynamic list of items in the DOM.
 *
 * @details
 * - Supports keyed updates to efficiently reorder items without full re-render.
 * - Creates, reuses, and removes item parts based on stable keys.
 * - Keys default to array index if no `.key` property is present.
 *
 * @see ValuePart
 * @see NestedPart
 * 
 * @created 2025-08-12
 * @author Henry
 */
export class ListPart implements Part {
  private keyMap = new Map<any, Part>();

  constructor(private marker: Comment, private helpers: PartHelpers) {}

  /**
   * Updates the list of items.
   * @param values An array of values; each can have a `.key` for stable identity.
   */
  apply(values: any[]) {
    if (!Array.isArray(values)) {
      this.clear();
      return;
    }

    const newKeyMap = new Map<any, Part>();
    let beforeNode: Node = this.marker;

    // Build new list in order
    values.forEach((value, index) => {
      const key = this.getKey(value, index);

      let part = this.keyMap.get(key);
      if (!part) part = this.createItemPart(beforeNode);

      part.apply(value);
      if (key != null) newKeyMap.set(key, part);

      // Move insertion point forward
      beforeNode = this.getEndNode(part) ?? beforeNode;
    });

    // Remove any parts not reused
    this.keyMap.forEach((part, key) => {
      if (!newKeyMap.has(key)) {
        part.remove();
      }
    });

    this.keyMap = newKeyMap;
  }

  /** Creates a new `ValuePart` before the given node. */
  private createItemPart(beforeNode?: Node): Part {
    const marker = document.createComment("item-marker");
    this.marker.parentNode?.insertBefore(marker, beforeNode || this.marker);
    return this.helpers.createPart({ kind: "value", marker });
  }

  /** Gets a stable key for a value, falling back to the index. */
  private getKey(value: any, index: number) {
    if (value?.key) return value.key;
    return index;
  }

  /** Tries to find the DOM node immediately after a part for insertion tracking. */
  private getEndNode(part: Part): Node | null {
    // If part has a root element or fragment, use its last child as end node
    const node = (part as any).node || (part as any).instance?.root;
    if (node instanceof DocumentFragment) {
      return node.childNodes[node.childNodes.length - 1] ?? null;
    }
    return node ?? (part as any).marker ?? null;
    // // This assumes parts always have a `marker` property or similar.
    // return (part as any).marker ?? null;
  }

  /** Removes all list items. */
  clear() {
    this.keyMap.forEach((part) => part.remove());
    this.keyMap.clear();
  }

  /** Removes all list items and the marker itself. */
  remove() {
    this.clear();
    this.marker.parentNode?.removeChild(this.marker);
  }
}
