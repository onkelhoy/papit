# @papit/data-structure

Classic data structures that don't ship with JavaScript, written in TypeScript with a small, consistent API surface.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/data-structure.svg?logo=npm)](https://www.npmjs.com/package/@papit/data-structure)

---

## Installation

```bash
npm install @papit/data-structure
```

## What's included

| Structure          | Import                               | Notes                                        |
| ------------------ | ------------------------------------ | -------------------------------------------- |
| Linked List        | `LinkedList<T>`                      | Singly linked, iterable, `O(1)` append       |
| Double Linked List | `DoubleLinkedList<T>`                | Doubly linked, iterable, `O(1)` append       |
| Queue              | `Queue<T>`                           | FIFO, built on `LinkedList`                  |
| Priority Queue     | `PriorityQueue<T>`                   | Binary min-heap, iterable                    |
| Stack              | `Stack<T>`                           | LIFO, array-backed                           |
| Tree               | `Tree<T>` / `TreeNode<T>`            | N-ary tree with DFS/BFS traversal            |
| Binary Search Tree | `BinarySearchTree<T>` / `BSTNode<T>` | Ordered, with pre/in/post-order DFS          |
| Graph              | `Graph<N, ID, EdgeType>`             | Directed graph with BFS and topological sort |

All structures are generic over the value type `T`, and every structure that makes sense to iterate implements the native JS iterator protocol, so `for...of` and spread (`[...list]`) work out of the box.

---

## Usage

### LinkedList / DoubleLinkedList

```ts
import { LinkedList, DoubleLinkedList } from "@papit/data-structure";

const list = new LinkedList([1, 2, 3]);
list.append(4);
list.insert(0, 2); // insert 0 before value 2
list.delete(3);

for (const value of list) console.log(value);

const dlist = new DoubleLinkedList(["a", "b", "c"]);
dlist.insert("z"); // inserted before front by default
```

### Queue

```ts
import { Queue } from "@papit/data-structure";

const queue = new Queue([1, 2, 3]);
queue.enqueue(4);
queue.dequeue(); // 1
queue.peek(); // 2
```

### PriorityQueue

Backed by a binary min-heap; lower `priority` values dequeue first.

```ts
import { PriorityQueue } from "@papit/data-structure";

const pq = new PriorityQueue<string>();
pq.enqueue("low priority", 10);
pq.enqueue("high priority", 1);

pq.dequeue(); // "high priority"
pq.peekWithPriority(); // { value: "low priority", priority: 10 }
```

### Stack

```ts
import { Stack } from "@papit/data-structure";

const stack = new Stack<number>();
stack.push(1);
stack.push(2);
stack.pop(); // 2
stack.peek(); // 1
```

### Tree

An N-ary tree where each node tracks its own children and parent.

```ts
import { Tree } from "@papit/data-structure";

const tree = new Tree<string>();
const root = tree.append("root");
const child = tree.append("child", root);
tree.append("grandchild", child);

tree.size(); // 3
tree.height(); // 2
tree.getLeaves(); // [TreeNode<"grandchild">]

tree.traverseDepthFirst?.(); // available on TreeNode instances
root.traverseBreadthFirst((node) => {
  console.log(node.value);
});
```

### BinarySearchTree

Values are compared automatically for `string` and `number` types, or via a `compareTo` method on custom objects. A custom comparator can also be passed to `find`.

```ts
import { BinarySearchTree } from "@papit/data-structure";

const bst = new BinarySearchTree<number>();
[5, 3, 8, 1, 4].forEach((v) => bst.insert(v));

bst.contains(4); // true
bst.min()?.value; // 1
bst.max()?.value; // 8
bst.delete(3);

bst.DFS("in"); // sorted ascending order
bst.DFS("pre"); // root, left, right
bst.DFS("post"); // left, right, root
```

### Graph

A directed graph with typed edges, BFS-based ancestor/descendant lookups, subgraph extraction, and Kahn/DFS-style topological sorting with cycle detection.

```ts
import { Graph, GraphNode } from "@papit/data-structure";

const graph = new Graph<GraphNode>();

graph.addNode(new GraphNode("a"));
graph.addNode(new GraphNode("b"));
graph.addNode(new GraphNode("c"));

graph.addEdge("a", "b", "depends-on");
graph.addEdge("b", "c", "depends-on");

graph.descendants("a"); // nodes reachable from "a"
graph.ancestors("c"); // nodes that can reach "c"
graph.toposort(); // topological order of all node ids

const sub = graph.subgraph(["a", "b"]); // induced subgraph
```

By default a `Graph` is `strict`, meaning `toposort()` throws on cycles. Pass `false` to the constructor for non-strict mode, where cyclic nodes are still included in the result instead of throwing.

---

## Development

This package is part of the [`@papit`](https://github.com/onkelhoy/papit) monorepo. See the root repository for build, test, and contribution tooling shared across all `@papit` packages.

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
