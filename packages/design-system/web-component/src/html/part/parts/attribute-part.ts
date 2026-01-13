import type { Part } from "../types";

/**
 * @fileoverview Handles reactive binding for a single HTML attribute.
 *
 * @details
 * - Updates or removes an attribute when its bound value changes.
 * - Treats `"key"` as a special case for list diffing: it is stored directly
 *   on the element (bypassing setAttribute) for synchronous access.
 *
 * @example
 * // Used internally by the template engine:
 * const part = new AttributePart(el, "class", [""]);
 * part.apply(["btn-primary"]);
 *
 * @see Part
 * 
 * @author Henry Pap
 * @created 2025-08-12
 */
export class AttributePart implements Part {

  private value: string | null = null;

  constructor(
    private element: Element,
    private name: string,
    public strings: string[],
    private standalone?: boolean,
  ) { }

  /**
   * Updates the attribute with new values.
   * @param values String fragments matching the `strings` template parts.
   */
  apply(values: (string | null)[]) {
    let value = "";
    for (let i = 0; i < values.length; i++) 
    {
      value += this.strings[i];
      value += values[i];
    }

    if (value === this.value) return;
    this.value = value;

    if (this.name === "key")
      (this.element as any).key = value;
    else if (this.standalone)
    {
      if (value && typeof value === "string" && !/false/.test(value))
      {
        this.name = value;
        this.element.toggleAttribute(value, true);
      }
      else
      {
        this.element.toggleAttribute(this.name, false);
      }
    }
    else
      this.element.setAttribute(this.name, value);
  }

  clear() {
    if (this.name === "key")
      delete (this.element as any).key;
    else
      this.element.removeAttribute(this.name);
  }

  remove() {
    this.clear();
  }
}