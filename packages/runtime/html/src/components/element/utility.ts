import { ExtendedList, List } from "../util";
import type Node from "./node";

export class NodeList extends List<Node> {}
export class DOMTokenList extends ExtendedList<string> {}
