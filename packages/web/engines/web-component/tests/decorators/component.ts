import { html, CustomElement, property, query, bind, debounce, context, throttle } from "@papit/web-component";

// --- Consumer ---
class ContextConsumer extends CustomElement {
    @context hello = "";

    render() {
        return html`<span data-key="hello">${this.hello}</span>`;
    }
}
customElements.define("context-consumer", ContextConsumer);

// --- Provider (custom element with context flag) ---
class ContextProvider extends CustomElement {
    @property({ context: true, rerender: true }) hello = "from-provider";

    render() {
        return html`<slot></slot>`;
    }
}
customElements.define("context-provider", ContextProvider);

// --- Consumer that names its provider: context `query` ---
class ContextQueryConsumer extends CustomElement {
    @context({
        query(this: ContextQueryConsumer) {
            const id = this.getAttribute("source");
            return id ? `#${id}` : "";
        },
    }) hello = "";

    render() {
        return html`<span data-key="hello">${this.hello}</span>`;
    }
}
customElements.define("context-query-consumer", ContextQueryConsumer);

// --- @query({ outside }): finds an element outside its own shadow root ---
class QueryOutside extends CustomElement {
    loaded = 0;
    errors = 0;

    @query<HTMLElement>({
        outside: true,
        selector(this: QueryOutside) {
            const id = this.getAttribute("target");
            return id ? `#${id}` : "section.query-zone";
        },
        load(this: QueryOutside) {
            this.loaded++;
        },
        error(this: QueryOutside) {
            this.errors++;
        },
    }) zone: HTMLElement | null = null;

    // inside its own shadow root, outside is not involved
    @query("b") bold!: HTMLElement;

    render() {
        return html`<b>own</b>`;
    }
}
customElements.define("query-outside", QueryOutside);

class Component extends CustomElement {

    // properties
    @property({ attribute: "yes-im-different" }) withDifferentAttribute = "";
    @property({ readonly: true, type: Number }) readonly = 3;
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

    // throttle cases
    @throttle
    throttleStandard() { this.number++; }

    @throttle(600)
    throttleDelay() { this.number++; }

    @throttle("throttleNameThrottled")
    throttleName() { this.number++; }

    @throttle({ delay: 600, name: "throttleFullThrottled" })
    throttleFull() { this.number++; }


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
            helölo
            <span>${this.counter}</span>
            <button @click="${this.handleInc}">inc</button>
            <button @click="${this.handleA}" id="a">A</button>
            <button @click="${this.handleB}" id="b">B</button>
        `
    }
}

window.customElements.define("core-decorators", Component);
