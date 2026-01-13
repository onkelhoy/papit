import CharacterData from "./character-data";
import Node from "./node";
import type Document from "./document";

export default class Comment extends CharacterData {
  constructor(ownerDocument: Document, content = "") {
    super(ownerDocument, content);
    this.nodeType = Node.COMMENT_NODE;
  }
}
