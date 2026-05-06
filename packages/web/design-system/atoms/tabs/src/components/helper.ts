// import statements 
// system 
import { context, CustomElementInternals, generateUUID, property } from "@papit/web-component";
import { Tabs } from "component";

/**
 * # Helper
 *
 * Internal base class shared by `Tab` and `TabPanel`. Handles context
 * subscription, selected-state management, and the pairing logic between a
 * tab and its panel via matching `value` attributes.
 *
 * Concrete subclasses override `setOpposite` to write the appropriate ARIA
 * relationship attribute (`aria-controls` for tabs, `aria-labelledby` for
 * panels) once the paired element is located.
 *
 * This class is not intended for direct use outside the `@papit/tabs` package.
 *
 * @internal
 */
export class Helper extends CustomElementInternals {

    @property({
        after(this: Helper) {
            if (!this.tabs) return;

            const opposite = this.tabs
                .querySelectorAll(`[value="${this.value}"]`)
                .values()
                .filter(e => e !== this)
                .toArray()
                .at(0);

            if (opposite instanceof HTMLElement) 
            {
                this.setOpposite(opposite);
            }
        }
    }) value!: string;

    @context({
        name: "value",
        update(this: Helper, value: string) {
            if (this.value === value)
            {
                this._internals.states.add("selected");
                if (this.tagName === "PAP-TAB")
                {
                    this.setAttribute("aria-selected", "true");
                }
            }
            else 
            {
                this._internals.states.delete("selected");
                if (this.tagName === "PAP-TAB")
                {
                    this.setAttribute("aria-selected", "false");
                }
            }
        }
    }) selected!: string;

    protected _tabs: Tabs | null = null;
    protected get tabs() {
        if (this._tabs) return this._tabs;

        let target = this.parentElement;
        while (target && !(target instanceof Tabs))
        {
            target = target.parentElement;
        }

        this._tabs = target;
        return this._tabs;
    }

    protected setOpposite(element: HTMLElement) { }

    connectedCallback(): void {
        super.connectedCallback();
        this.id = this.id || generateUUID();
        if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    }
}