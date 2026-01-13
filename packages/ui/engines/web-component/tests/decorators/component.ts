import { html, CustomElement, property, query, bind, debounce, } from "@papit/web-component";

class Component extends CustomElement {

    // properties
    @property({ attribute: "yes-im-different" }) withDifferentAttribute = "";
    @property({ readonly: true }) readonly = 3;
    @property string = "";
    @property({ type: Number }) number = 0;
    @property({ type: Number, rerender: true }) counter = 0;
    @property({ type: Number }) bindCase = 0;
    @property({ type: Object }) object = { hello: "henry" };
    @property({ type: Date }) date = new Date();
    @property({ type: Boolean }) queryCase = false;
    @property({
        type: Boolean,
        removeAttribute: false,
    }) boolean = false;
    @property({ type: Boolean }) booleanWithRemove = false;


    @property attributeCase = "attribute";
    @property({ attribute: "attribute-case-2" }) attributeCase2 = "attribute";
    @property({ attribute: false }) attributeCase3 = "attribute";

    @property initialValue = "initial";
    @property({ attribute: "initial-value-2" }) initialValue2 = "initial-property";

    // helper for span 
    @query("span") span!: HTMLSpanElement;
    // query cases 
    @query("#a") buttonA!: HTMLButtonElement;
    @query({
        selector: "#b",
        load: function (this: Component) {
            this.queryCase = true;
        }
    }) buttonB!: HTMLButtonElement;


    // bind cases
    handleA() {
        if (this.bindCase !== undefined) this.bindCase++;
    }
    @bind
    handleB() {
        if (this.bindCase !== undefined) this.bindCase++;
    }


    // debouce cases
    @debounce
    debounceStandard() {
        this.number++;
    }
    @debounce(600)
    debounceDelay() {
        this.number++;
    }
    @debounce("debounceNameDebounced")
    debounceName() {
        this.number++;
    }
    @debounce({
        delay: 600,
        name: "debounceFullDebounced",
    })
    debounceFull() {
        this.number++;
    }

    @bind
    handleInc() {
        this.counter++;
    }

    render() {
        return html`
            <span>${this.counter}</span>
            <button @click="${this.handleInc}">inc</button>
            <button @click="${this.handleA}" id="a">A</button>
            <button @click="${this.handleB}" id="b">B</button>
        `
    }
}

window.customElements.define("core-decorators", Component);
