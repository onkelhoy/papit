import type { Part, PartHelpers } from "../types";
import { getValues } from "../../html";

type Item = { start: Comment; end: Comment; part: Part };

/**
 * @fileoverview Manages a dynamic list of items in the DOM.
 *
 * @details
 * - Supports keyed updates to efficiently reorder items without full re-render.
 * - Creates, reuses, moves and removes item parts based on stable keys.
 * - A key is the value's `.key`, or the `key` attribute of an `html` template root,
 *   falling back to the array index. A repeated key gets a fresh item.
 * - Each item sits between its own start and end comment, so it can be moved as a whole.
 *
 * @see ValuePart
 * @see NestedPart
 *
 * @created 2025-08-12
 * @author Henry
 */
export class ListPart implements Part {
  private items = new Map<any, Item>();
  private order: Item[] = [];

  constructor(private marker: Comment, private helpers: PartHelpers) {}

  /**
   * Updates the list of items.
   * @param values An array of values; each can have a `.key` (or `key` attribute) for stable identity.
   */
  apply(values: any[]) {
    if (!Array.isArray(values)) {
      this.clear();
      return;
    }

    const keys = values.map((value, index) => this.getKey(value, index));
    const next = new Map<any, Item>();
    const seen = new Set<any>();
    keys.forEach((key, index) => {
      if (seen.has(key)) keys[index] = Symbol("duplicate-key");
      seen.add(key);
      const item = this.items.get(keys[index]);
      if (item) next.set(keys[index], item);
    });

    // Remove any items not reused
    this.items.forEach((item, key) => {
      if (!next.has(key)) this.removeItem(item);
    });

    // Lay out in order; cursor is where the next item has to start
    const reused = new Set(next.values());
    let cursor: Node = this.order.find(item => reused.has(item))?.start ?? this.marker;
    const order: Item[] = [];

    values.forEach((value, index) => {
      const key = keys[index];
      let item = next.get(key);

      if (!item) {
        item = this.createItem(cursor);
        next.set(key, item);
      }
      else if (item.start === cursor) {
        cursor = item.end.nextSibling ?? this.marker;
      }
      else {
        this.moveItem(item, cursor);
      }

      item.part.apply(value);
      order.push(item);
    });

    this.items = next;
    this.order = order;
  }

  /** Creates a new item (start comment + `ValuePart` on its end comment) before the given node. */
  private createItem(beforeNode: Node): Item {
    const start = document.createComment("item-start");
    const end = document.createComment("item-marker");
    this.marker.parentNode?.insertBefore(start, beforeNode);
    this.marker.parentNode?.insertBefore(end, beforeNode);
    return { start, end, part: this.helpers.createPart({ kind: "value", marker: end }) };
  }

  /** Moves every node of an item, start to end, before the given node. */
  private moveItem(item: Item, beforeNode: Node) {
    const parent = this.marker.parentNode;
    if (!parent) return;
    let node: Node | null = item.start;
    while (node) {
      const next: Node | null = node === item.end ? null : node.nextSibling;
      parent.insertBefore(node, beforeNode);
      node = next;
    }
  }

  private removeItem(item: Item) {
    item.part.remove();
    item.start.parentNode?.removeChild(item.start);
  }

  /** Gets a stable key for a value, falling back to the index. */
  private getKey(value: any, index: number) {
    if (value?.key != null) return value.key;
    if (value?.__isTemplateRoot && value instanceof Element && value.hasAttribute("key")) {
      return templateKey(value) ?? index;
    }
    return index;
  }

  /** Removes all list items. */
  clear() {
    this.items.forEach((item) => this.removeItem(item));
    this.items.clear();
    this.order = [];
  }

  /** Removes all list items and the marker itself. */
  remove() {
    this.clear();
    this.marker.parentNode?.removeChild(this.marker);
  }
}

// the root's `key` attribute; when it holds interpolations the clone only has markers,
// so it's rebuilt from the template strings and values
function templateKey(root: Element): string | undefined {
  const attribute = root.getAttribute("key")!;
  if (!attribute.includes("__marker__")) return attribute;

  const strings = (root as any).__template as TemplateStringsArray | undefined;
  const values = getValues(root);
  if (!strings || !values) return undefined;

  const start = strings.findIndex(s => /\skey=["']?$/.test(s));
  if (start < 0) return undefined;

  const quote = /["']$/.test(strings[start]) ? strings[start].at(-1)! : null;
  let key = "";
  for (let i = start; i < values.length; i++) {
    key += String(values[i]);
    const after = strings[i + 1] ?? "";
    const close = quote ? after.indexOf(quote) : after.search(/[\s>]/);
    if (close >= 0) return key + after.slice(0, close);
    key += after;
  }
  return key;
}
