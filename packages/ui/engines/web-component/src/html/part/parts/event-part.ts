import type { Part } from "../types";

/**
 * @fileoverview Manages binding and unbinding of DOM event listeners.
 *
 * @details
 * - Ensures old listeners are removed before new ones are attached.
 * - Supports both function listeners and `EventListenerObject` handlers.
 *
 * @example
 * // Used internally by the template engine:
 * const part = new EventPart(button, "click");
 * part.apply(() => console.log("Clicked"));
 *
 * @see Part
 * 
 * @author Henry Pap
 * @created 2025-08-12
 */
export class EventPart implements Part {

  private value: EventListenerOrEventListenerObject | null = null;

  constructor(
    private element: Element,
    private name: string,
  ) { }

  /**
   * Attaches a new listener and removes any previously bound one.
   * @param value The event listener or `EventListenerObject`, or `null` to unbind.
   */
  apply(
    value: EventListenerOrEventListenerObject | null
  ) {
    if (this.value)
    {
      this.element.removeEventListener(this.name as keyof ElementEventMap, this.value);
    }

    if (value)
    {
      this.element.addEventListener(this.name as keyof ElementEventMap, value);
    }

    this.value = value;
  }

  clear() {
    if (this.value) this.element.removeEventListener(this.name as keyof ElementEventMap, this.value);
  }

  remove() {
    this.clear();
  }
}