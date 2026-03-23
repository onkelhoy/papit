import type { Part, PartHelpers, ITemplateInstance } from "../types";
import { getValues } from "../../html";

/**
 * @fileoverview Manages a nested template instance at a marker position.
 *
 * @details
 * - Accepts only elements marked with `__isTemplateRoot`.
 * - Creates a child template instance once and reuses it on updates.
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

    if (!this.instance) {
      this.instance = this.helpers.createTemplateInstance(newValue);

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
    }
  }
  
  remove() {
    this.clear();
    this.marker.parentNode?.removeChild(this.marker);
  }
}
