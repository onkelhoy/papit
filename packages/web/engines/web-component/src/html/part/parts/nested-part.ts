import type { Part, PartHelpers, ITemplateInstance } from "../types";
import { getValues } from "../../html";

/**
 * @fileoverview Manages a nested template instance at a marker position.
 *
 * @details
 * - Accepts only elements marked with `__isTemplateRoot`.
 * - Creates a child template instance once and reuses it while the template stays the same.
 * - Updates child instance values without re-rendering the parent.
 *
 * @see Part
 * @see PartHelpers
 * @see ITemplateInstance
 * @see getValues
 * 
 * @created 2025-08-12
 * @author Henry
 */
export class NestedPart implements Part {
  private instance: ITemplateInstance | null = null;
  // which template the instance came from, a different one remounts
  private key: unknown = undefined;

  constructor(
    private marker: Comment,
    private helpers: PartHelpers
  ) {}

  /**
   * Creates or updates a nested template instance.
   * @param newValue is expected to be an Element with `__isTemplateRoot` - otherwise its cleared
   */
  apply(newValue: any) {
    if (!(newValue instanceof Element || newValue instanceof DocumentFragment) || !(newValue as any).__isTemplateRoot) {
      this.clear();
      return;
    }

    const values = getValues(newValue);
    const key = (newValue as any).__template ?? newValue;
    if (this.instance && key !== this.key) this.clear();

    if (!this.instance) {
      this.instance = this.helpers.createTemplateInstance(newValue);
      this.key = key;

      // Insert into DOM before the marker
      this.marker.parentNode!.insertBefore(newValue, this.marker);

      if (values) {
        this.instance.update(values);
      }
    } else if (values) {
      this.instance.update(values);
    }
  }

  clear() {
    if (this.instance) {
      this.instance.remove();
      this.instance = null;
      this.key = undefined;
    }
  }
  
  remove() {
    this.clear();
    this.marker.parentNode?.removeChild(this.marker);
  }
}
