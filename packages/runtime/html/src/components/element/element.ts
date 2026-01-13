import { HtmlToken } from "@papit/lexer";

import Node from "./node";
import { DOMTokenList } from "./utility";
import type Document from "./document";
import type DocumentType from "./document-type";

import { Builder, Queue } from "../util";
import { Query } from "../query";

type QueryQueue = Queue<ReturnType<typeof Query>[number]>;
export default class Element extends Node {
  public constructor(ownerDocument?: Document, tagName = "") {
    super(ownerDocument);
    this.nodeType = Node.ELEMENT_NODE;
    this._tagName = tagName;
  }

  override appendChild(child: Node): void {
    this._innerHTML = null;
    return super.appendChild(child);
  }
  override removeChild(child: Node): boolean {
    this._innerHTML = null;
    return super.removeChild(child);
  }

  private _children: Element[] | null = null;
  get children() {
    if (this._children === null || this._dirty.has("children"))
    {
      this._dirty.delete("children");
      this._children = Array.from(this._childNodes).filter(node => node instanceof Element)
    }

    return this._children;
  }

  get previousElementSibling(): Element | null {
    if (!this.parentElement) return null;
    const children = this.parentElement.children;
    const index = this.parentElement.getChildPosition(this);
    return children[index + 1] ?? null;
  }
  get nextElementSibling(): Element | null {
    if (!this.parentElement) return null;
    const children = this.parentElement.children;
    const index = this.parentElement.getChildPosition(this);
    return children[index - 1] ?? null;
  }

  get firstElementChild(): Element | null { return this.children.pop() ?? null }
  get lastElementChild(): Element | null { return this.children[0] ?? null }

  get className() {
    const value = this._attributes.get("class");
    if (typeof value === "string") return value;
    return "";
  }
  set className(value: string) {
    this.setAttribute("class", value)
    this._classList = null;
  }

  private _classList: DOMTokenList | null = null;
  get classList() {
    if (!this._classList) 
    {
      this._classList = new DOMTokenList(this.className.split(" "));
      this._classList.addEventListener("change", () => {
        this.setAttribute("class", Array.from(this._classList ?? []).join(" "));
      });
    }
    return this._classList;
  }

  get tagName() { return this._tagName ?? "" }
  private _tagName: string | null = null;
  set tagName(value: string) { this._tagName = value }

  get innerHTML() {
    if (!this._innerHTML || this._dirty.has("innerHTML"))
    {
      this._innerHTML = (!this._dirty.has("textContent") && this._textContent ? this._textContent : "") + this._childNodes.map(child => {
        if (child instanceof Element) return child.outerHTML;
        if (child.nodeType === Node.COMMENT_NODE) return `<!-- ${child.textContent} -->`
        if (child.nodeType === Node.DOCUMENT_TYPE_NODE) return `<!DOCTYPE ${(child as DocumentType).name}>`

        return child.textContent
      }).join("");

      this._dirty.delete("innerHTML");
    }
    return this._innerHTML;
  }
  private _innerHTML: string | null = null;
  set innerHTML(value: string) {
    this._innerHTML = value;
    this._dirty.delete("innerHTML");
    this.dirty("innerHTML");
    this.setHTML(value);
  }

  get outerHTML(): string {
    if (!this._outerHTML || this._dirty.has("outerHTML"))
    {
      const attributes = Array
        .from(this._attributes.keys())
        .sort((a, b) => {
          if (a === "id") return -1;  // id comes first
          if (b === "id") return 1;   // id comes first
          if (a === "class") return -1;  // class comes second
          if (b === "class") return 1;   // class comes second
          return 0;  // keep original order for other attributes
        })
        .map(key => this._attributes.get(key) === true ? key : `${key}="${this._attributes.get(key)}"`);
      this._outerHTML = `<${this.tagName}${attributes.length ? " " + attributes.join(" ") : ""}`;
      this._dirty.delete("outerHTML");
    }

    return `${this._outerHTML}${(this.innerHTML || this.tagName === "script" || this.tagName.includes("-")) ? `>${this.innerHTML ?? ""}</${this.tagName}>` : " />"}`;
  }
  private _outerHTML: string | null = null;

  get id(): string {
    const value = this._attributes.get("id");
    if (typeof value === "string") return value;
    return "";
  }
  set id(value: string) { this.setAttribute("id", value) }

  get attributes(): Map<string, string | true> { return new Map(this._attributes) };
  private _attributes = new Map<string, string | true>();
  protected set attributes(attributes: Record<string, string | true>) {
    this._attributes = new Map();
    for (const key in attributes)
    {
      this._attributes.set(key, attributes[key]);
    }
    this.dirty("innerHTML");
  }

  // expose tokens for whatever reason
  private _tokens: HtmlToken[] = [];
  get tokens() { return this._tokens }

  setHTML(value: string) {
    this._tokens = Builder(this, value);
    this._outerHTML = null;
  }
  getAttribute(name: string) {
    return this._attributes.get(name);
  }
  hasAttribute(name: string) {
    return this._attributes.has(name);
  }
  setAttribute(name: string, value?: string) {
    this._attributes.set(name, value ? value : true);
    this._outerHTML = null;
    this._outerHTML = null;
    this.dirty("innerHTML");
  }
  toggleAttribute(name: string) {
    if (this._attributes.has(name)) return this._attributes.delete(name);
    this._attributes.set(name, true);
    this._outerHTML = null;
    this.dirty("innerHTML");
    return true;
  }
  removeAttribute(name: string) {
    this._outerHTML = null;
    this.dirty("innerHTML");
    return this._attributes.delete(name);
  }
  matches(selector: string) {
    const query = Element.getQuery("matches", selector);
    const last = query.pop();
    if (last)
    {
      return Element.matches(this, last);
    }
  }
  querySelector(selector: string | QueryQueue) {
    const queue = Element.getQuery("querySelector", selector);
    // return Element.queryInternal(this, query, false);
    // return Element.matchesDeep(this, queue);

    const allmatches: Element[] = [];
    this.children.forEach(child => {
      Element.findChain(child, queue, false, allmatches);
    });

    return allmatches.at(0) ?? null;
  }
  querySelectorAll(selector: string | QueryQueue) {
    const queue = Element.getQuery("querySelectorAll", selector);

    const allmatches: Element[] = [];
    this.children.forEach(child => {
      Element.findChain(child, queue, true, allmatches);
    });

    return allmatches;
  }
  closest(selector: string | QueryQueue) {
    const query = Element.getQuery("closest", selector).pop();
    if (!query) return null;

    let current: Element | null = this;

    while (current)
    {
      if (Element.matches(current, query))
      {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  private static getQuery(name: string, selector: string | QueryQueue) {
    if (selector === "") throw new SyntaxError(`Failed to execute '${name}' on 'Element': The provided selector is empty.`);
    if (typeof selector === "string")
    {
      return new Queue<ReturnType<typeof Query>[number]>([...Query(selector)].reverse());
    }

    return selector;
  }
  private static matches(elm: Element, query: ReturnType<typeof Query>[number]): boolean {
    if (query.tag && elm.tagName !== query.tag) return false;

    if (query.id && elm.id !== query.id) return false;

    if (query.class && !query.class.every(className => elm.classList.contains(className))) return false;

    if (query.attribute)
    {
      const value = elm.getAttribute(query.attribute.name);
      if (!value) return false;

      const qvalue = query.attribute.value;
      if (qvalue !== true && qvalue !== value) return false;
    }

    if (query.text && !elm.textContent?.startsWith(query.text)) return false;

    return true;
  }

  private static findChain(element: Element, queue: QueryQueue, all = false, allmatches: Element[] = []) {
    const matched = this.checkChain(element, queue.copy());
    if (matched) 
    {
      allmatches.push(matched);
      if (!all) return allmatches;
    }

    for (const child of element.children)
    {
      this.findChain(child, queue, all, allmatches);
      if (!all && allmatches.length > 0) return allmatches;
    }
  }

  private static checkChain(element: Element, queue: QueryQueue, isdescendant = false): Element | null {
    const query = queue.pop();
    if (!query) return element;

    if (!isdescendant && !Element.matches(element, query)) return null;

    // If queue is now empty, we matched the full selector
    if (queue.length === 0) return element;

    if (query.relation === "sibling")
    {
      if (!element.nextElementSibling) return null;
      return this.checkChain(element.nextElementSibling, queue);
    }

    for (const child of element.children)
    {
      const copy = queue.copy();
      const matched = this.checkChain(child, copy, query.relation === "descendant");
      if (matched) return matched;
    }

    return null;
  }
}
