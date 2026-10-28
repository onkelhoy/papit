import { html, CustomElement, property, bind, } from "@papit/web-component";


class InsideComponent extends CustomElement {
  @property({ rerender: true }) name = "bajs";

  render() {
    return html`
      <p>${this.name}</p>
    `
  }
}

class OutsideComponent extends CustomElement {
  @property({ rerender: true }) name = "henry";

  render() {
    return html`
      <p>${this.name}</p>
      <attr-inside name="${this.name}"></attr-inside>
    `
  }
}
class SelectComponent extends CustomElement {
  @property({ rerender: true }) name = "henry";

  render() {
    return html`
      <select>
        <option value="henry" ${this.name === "henry" && "selected"}>henry is selcted</option>
        <option value="oscar" ${this.name === "oscar" && "selected"}>oscar is selcted</option>
        <option value="bajs" ${this.name === "bajs" && "selected"}>bajs is selcted</option>
      </select>
    `
  }
}

class EventInsideComponent extends CustomElement {
  @property({ rerender: true, type: Number }) count = 7;

  render() {
    return html`
      <p count=${this.count}>${this.count}</p>
    `
  }
}
class EventComponent extends CustomElement {
  @property({ rerender: true, type: Number }) count = 3;

  @bind
  method() {
    this.count++;
  }

  render() {
    return html`
      <attr-event-inside count=${this.count} @click=${this.method}></attr-event-inside>
    `
  }
}

class KeyedList extends CustomElement {
  @property({ rerender: true }) items: string[] = ["A", "B", "C"];

  render() {
    return html`
      <ul>
        ${this.items.map((item) => html`<li key="${item}-key">${item}</li>`)}
      </ul>
    `
  }
}

window.customElements.define("attr-event-inside", EventInsideComponent);
window.customElements.define("attr-event", EventComponent);
window.customElements.define("attr-select", SelectComponent);
window.customElements.define("attr-inside", InsideComponent);
window.customElements.define("attr-outside", OutsideComponent);
window.customElements.define("keyed-list", KeyedList);
