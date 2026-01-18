import {describe, it, beforeEach} from "node:test";
import assert from "node:assert";
import {Tree} from "@papit/data-structure";

describe("Tree", () => {
    let tree;

    beforeEach(() => {
        tree = new Tree();
    });

    it("should start empty", () => {
        assert.equal(tree.size(), 0);
        assert.equal(tree.height(), 0);
        assert.deepStrictEqual(tree.getLeaves(), []);
    });

    it("should create root on first append", () => {
        const root = tree.append("root");
        assert.equal(tree.root, root);
        assert.equal(tree.size(), 1);
        assert.equal(tree.height(), 0);
    });

    it("should append children to root by default", () => {
        const root = tree.append("root");
        const a = tree.append("a");
        const b = tree.append("b");

        assert.equal(root.children.length, 2);
        assert.deepStrictEqual(
            root.children.map(n => n.value),
            ["a", "b"]
        );
    });

    it("should append under a specific parent", () => {
        const root = tree.append("root");
        const a = tree.append("a", root);
        const b = tree.append("b", a);

        assert.equal(a.parent, root);
        assert.equal(b.parent, a);
        assert.equal(root.children[0], a);
        assert.equal(a.children[0], b);
    });

    it("should calculate size correctly", () => {
        const root = tree.append(1);
        const a = tree.append(2, root);
        tree.append(3, root);
        tree.append(4, a);

        assert.equal(tree.size(), 4);
    });

    it("should calculate height correctly", () => {
        const root = tree.append("root");
        const a = tree.append("a", root);
        const b = tree.append("b", a);
        tree.append("c", b);

        assert.equal(tree.height(), 3);
    });

    it("should return correct leaves", () => {
        const root = tree.append("root");
        const a = tree.append("a", root);
        const b = tree.append("b", root);
        tree.append("c", a);

        const leaves = tree.getLeaves().map(n => n.value).sort();
        assert.deepStrictEqual(leaves, ["b", "c"]);
    });

    it("should find nodes using DFS", () => {
        const root = tree.append(1);
        const a = tree.append(2, root);
        const b = tree.append(3, a);

        assert.equal(tree.findNode(3), b);
        assert.equal(tree.findNode(999), undefined);
    });

    it("should traverse depth-first", () => {
        const root = tree.append(1);
        tree.append(2, root);
        tree.append(3, root);

        const visited = [];
        root.traverseDepthFirst(node => {
            visited.push(node.value);
        });

        assert.deepStrictEqual(visited, [1, 2, 3]);
    });

    it("should traverse breadth-first", () => {
        const root = tree.append(1);
        const a = tree.append(2, root);
        tree.append(3, root);
        tree.append(4, a);

        const visited = [];
        root.traverseBreadthFirst(node => {
            visited.push(node.value);
        });

        assert.deepStrictEqual(visited, [1, 2, 3, 4]);
    });

    it("should delete a leaf node", () => {
        const root = tree.append(1);
        tree.append(2, root);
        tree.append(3, root);

        tree.delete(2);

        assert.equal(tree.size(), 2);
        assert.deepStrictEqual(
            root.children.map(n => n.value),
            [3]
        );
    });

    it("should delete a subtree", () => {
        const root = tree.append("root");
        const a = tree.append("a", root);
        tree.append("b", a);
        tree.append("c", a);

        tree.delete("a");

        assert.equal(tree.size(), 1);
        assert.deepStrictEqual(tree.getLeaves().map(n => n.value), ["root"]);
    });

    it("should delete root", () => {
        tree.append("root");
        tree.delete("root");

        assert.equal(tree.root, undefined);
        assert.equal(tree.size(), 0);
    });

    it("should throw when deleting from empty tree", () => {
        assert.throws(() => tree.delete("x"));
    });

    it("should throw when deleting missing node", () => {
        tree.append(1);
        assert.throws(() => tree.delete(999));
    });
});
