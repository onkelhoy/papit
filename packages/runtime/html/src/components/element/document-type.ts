import Node from "./node";
import type Document from "./document";

export default class DocumentType extends Node {
  constructor (ownerDocument: Document, private _name: string) {
    super(ownerDocument);
    this.nodeType = Node.DOCUMENT_TYPE_NODE;
  }

  get name() { return this._name }
}
