import Node from "./node";
import type Document from "./document";
import CharacterData from "./character-data";

export default class Text extends CharacterData {
  constructor(ownerDocument: Document, content = "") {
    super(ownerDocument, content);
    this.nodeType = Node.TEXT_NODE;
  }
}