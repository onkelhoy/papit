import Node from "./node";
import Element from "./element";
import Text from "./text";
import HTMLElement from "./html-element";
import Comment from "./comment";
import DocumentType from "./document-type";

class HierarchyRequestError extends Error {}
export default class Document extends Element {
  constructor () {
    super();
    this.ownerDocument = this;
    this.nodeType = Node.DOCUMENT_NODE;
  }

  private _doctype: DocumentType|null = null;
  get doctype(): DocumentType|null { return this._doctype }
  set doctype(value: string) {
    if (this._doctype === null)
    {
      const doctype = new DocumentType(this, value);
      this._doctype = doctype;
      this.appendChild(doctype);
    }
  }

  override get outerHTML() { return this.innerHTML }
  override set outerHTML(value:string) { this.setHTML(value) }

  get documentElement(): Element|null { return this.children[0] ?? null }
  get body(): Element|null { return this.querySelector("body") }
  get head(): Element|null { return this.querySelector("head") }
  get title(): string|null { return this.querySelector("head > title")?.textContent ?? null }
  set title(value: unknown) { 
    const title = this.querySelector("head > title");
    if (title) title.textContent = String(value);
  }

  override appendChild(child: Node): void {
    if (child instanceof Element && this.children.length > 0)
    {
      throw new HierarchyRequestError("Failed to execute 'appendChild' on 'Node': Only one element on document allowed.");
    }

    super.appendChild(child);
  }

  createTextNode(content:string) {
    return new Text(this, content);
  }
  createElement(localName:string) {
    return new HTMLElement<typeof localName>(this, localName);
  }
  createComment(data:string) {
    return new Comment(this, data);
  }
}
