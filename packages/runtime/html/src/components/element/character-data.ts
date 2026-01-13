import Node from "./node";
import type Document from "./document";

export default abstract class CharacterData extends Node {
  constructor(ownerDocument: Document, content = "") {
    super(ownerDocument);
    this.nodeType = Node.CDATA_SECTION_NODE;
    this._textContent = content.trim();
  }

  override get textContent() { return this._textContent ?? "" }
  override set textContent(value: string) { 
    this._textContent = value.trim();
    this.dirty("textContent");
  }

  get data() { return this.textContent }
  set data(value: string) { this.textContent = value }
  get length() { return this.textContent.length }

  remove() { this.parentNode?.removeChild(this) }
  appendData(data:string) { this.data += data }
  deleteData(offset:number, count:number) { 
    const start = this.textContent.slice(0, offset);
    const end = this.textContent.slice(offset + count, this.textContent.length);
    this.textContent = start + end;
  }
}
