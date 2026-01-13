import {describe, it, beforeEach} from "node:test";
import assert from "node:assert";
import {BinarySearchTree} from "@papit/data-structure";

describe("BinarySearchTree", () => {
    let tree;

    beforeEach(() => {
        tree = new BinarySearchTree();
    });

    it("should start empty", () => {
        assert.equal(tree.root, undefined);
        assert.equal(tree.contains(1), false);
    });

    it("should insert root", () => {
        const node = tree.insert(10);
        assert.equal(tree.root, node);
        assert.equal(tree.root.value, 10);
    });

    it("should insert left and right correctly", () => {
        tree.insert(10);
        tree.insert(5);
        tree.insert(15);

        assert.equal(tree.root.left.value, 5);
        assert.equal(tree.root.right.value, 15);
    });

    it("should find existing values", () => {
        tree.insert(10);
        tree.insert(5);
        tree.insert(15);

        assert.equal(tree.find(5).value, 5);
        assert.equal(tree.find(15).value, 15);
        assert.equal(tree.find(999), undefined);
    });

    it("should compute min and max", () => {
        tree.insert(10);
        tree.insert(5);
        tree.insert(1);
        tree.insert(20);

        assert.equal(tree.min().value, 1);
        assert.equal(tree.max().value, 20);
    });

    it("should delete a leaf node", () => {
        tree.insert(10);
        tree.insert(5);
        tree.insert(15);

        assert.equal(tree.delete(5), true);
        assert.equal(tree.find(5), undefined);
        assert.equal(tree.root.left, undefined);
    });

    it("should delete node with one child", () => {
        tree.insert(10);
        tree.insert(5);
        tree.insert(2);

        tree.delete(5);

        assert.equal(tree.root.left.value, 2);
        assert.equal(tree.root.left.parent, tree.root);
    });

    it("should delete node with two children", () => {
        tree.insert(10);
        tree.insert(5);
        tree.insert(15);
        tree.insert(12);
        tree.insert(20);

        tree.delete(15);

        assert.equal(tree.find(15), undefined);
        assert.equal(tree.root.right.value, 20);
        assert.equal(tree.root.right.left.value, 12);
    });

    it("should delete root", () => {
        tree.insert(10);
        tree.insert(5);
        tree.insert(15);

        tree.delete(10);

        assert.ok(tree.root);
        assert.notEqual(tree.root.value, 10);
    });

    it("contains should reflect membership", () => {
        tree.insert(1);
        tree.insert(2);

        assert.equal(tree.contains(1), true);
        assert.equal(tree.contains(3), false);
    });
});
