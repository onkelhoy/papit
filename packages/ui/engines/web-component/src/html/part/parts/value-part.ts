import type { Part, PartHelpers } from "../types";

/**
 * @fileoverview Handles dynamic values in a template.
 *
 * @details
 * - Replaces a marker comment with strings, DOM nodes, or nested templates.
 * - Avoids full re-renders by only updating the changed value.
 * - Supports:
 *   1. Nested template roots (`__isTemplateRoot`)
 *   2. Direct DOM `Node` insertion
 *   3. Primitive-to-string conversion
 *
 * @example
 * const part = new ValuePart(marker, helpers);
 * part.apply("Hello");
 * part.apply(document.createElement("span"));
 *
 * @see Part
 * @see PartHelpers
 * 
 * @created 2025-08-12
 * @author Henry
 */
export class ValuePart implements Part {
  private value: any = null;
  private node: Node | null = null;
  private nestedInstance: Part | null = null;

  constructor(
    private marker: Comment,
    private helpers: PartHelpers
  ) { }

  /**
   * Inserts or updates the value before the marker.
   * @param newValue Strings, Nodes, or nested template roots.
   */
  apply(newValue: any) {
    if (!newValue && newValue !== 0) return void this.clear();
    if (newValue === this.value) return;
    this.value = newValue;

    // special case Text 
    if (newValue instanceof Text)
    {
      this.clear();
      this.node = newValue;
      this.insert(this.node);
      return;
    }


    // --- 1. Handle nested template (pure Element from html())
    if ((newValue as any).__isTemplateRoot || newValue instanceof DocumentFragment)
    {
      if (this.nestedInstance == null)
      {
        this.clear();
        this.nestedInstance = this.helpers.createPart({
          kind: "nested",
          marker: this.marker, // reuse the same marker 
        });
      }
      this.nestedInstance.apply(newValue);
      return;
    }

    // --- 2a. Handle DocumentFragment explicitly
    if (newValue instanceof DocumentFragment)
    {
      this.clear();
      this.node = newValue;
      this.marker.parentNode?.insertBefore(newValue, this.marker);
      return;
    }

    // --- 2b. Handle DOM nodes directly
    if (newValue instanceof Node)
    {
      if (newValue === this.node) return; // skip same node
      this.clear();
      this.node = newValue;
      this.insert(newValue);
      return;
    }

    // --- 3. Everything else → string
    const str = newValue != null ? String(newValue) : "";
    if (this.node instanceof Text)
    {
      this.node.data = str;
      return;
    }

    this.clear();
    this.node = document.createTextNode(str);
    this.insert(this.node);
  }

  private insert(node: Node) {
    this.marker.parentNode?.insertBefore(node, this.marker);
  }


  clear() {
    // Remove DOM node if present
    if (this.node && this.node.parentNode)
    {
      this.node.parentNode.removeChild(this.node);
    }
    this.node = null;

    // Clear nested instance if present
    if (this.nestedInstance)
    {
      this.nestedInstance.clear();
      this.nestedInstance = null;
    }

    this.value = null;
  }

  remove() {
    this.clear();
    this.nestedInstance?.remove();
    this.marker.parentNode?.removeChild(this.marker);
  }
}
