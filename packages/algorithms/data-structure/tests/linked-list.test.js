import {describe, it, beforeEach} from "node:test";
import assert from "node:assert";
import {LinkedList, DoubleLinkedList} from "@papit/data-structure";

describe('LinkedList', () => {

    describe("Single Linked List", () => {
        it("should be able to create from array", () => {
            const list = new LinkedList([1, 2, 3, 4]);
            assert.equal(list.front.value, 1);
            assert.equal(list.rear.value, 4);
            assert.equal(list.size, 4);
        })
        it("should generate array", () => {
            const list = new LinkedList([1, 2, 3, 4]);
            const arr = Array.from(list);

            assert.deepStrictEqual(arr, [1, 2, 3, 4]);
        })
        it("should be able to append", () => {
            const list = new LinkedList();
            assert.equal(list.size, 0);
            list.append(1);
            assert.equal(list.size, 1);
            assert.equal(list.front.value, 1);
            assert.equal(list.rear.value, 1);
            list.append(2);
            assert.equal(list.front.value, 1);
            assert.equal(list.rear.value, 2);
            assert.equal(list.size, 2);
        })
        it("should be able to delete", () => {
            const list = new LinkedList([1, 2, 3, 4]);
            assert.equal(list.front.next.next.value, 3);
            list.delete(3);
            assert.equal(list.size, 3);
            assert.equal(list.front.next.next.value, 4);
        })
        it("should be able to insert", () => {
            const list = new LinkedList([1, 2, 3, 4]);
            list.insert(3);
            assert.equal(list.front.value, 3);
            list.insert(45, 4);
            assert.equal(list.front.next.next.next.next.value, 45);
        })
        it("should find", () => {
            const list = new LinkedList([1, 2, 3, 4]);
            const node = list.find(2);
            assert.equal(node.value, 2);
            assert.equal(node.next.value, 3);
        })
    })

    describe("Double Linked List", () => {
        it("should be able to create from array", () => {
            const list = new DoubleLinkedList([1, 2, 3, 4]);
            assert.equal(list.front.value, 1);
            assert.equal(list.rear.value, 4);
            assert.equal(list.size, 4);
        })
        it("should generate array", () => {
            const list = new LinkedList([1, 2, 3, 4]);
            const arr = Array.from(list);

            assert.deepStrictEqual(arr, [1, 2, 3, 4]);
        });
        it("should be able to append", () => {
            const list = new DoubleLinkedList();
            assert.equal(list.size, 0);
            list.append(1);
            assert.equal(list.size, 1);
            assert.equal(list.front.value, 1);
            assert.equal(list.rear.value, 1);
            list.append(2);
            assert.equal(list.front.value, 1);
            assert.equal(list.rear.value, 2);
            assert.equal(list.size, 2);
        })
        it("should find", () => {
            const list = new DoubleLinkedList([1, 2, 3, 4]);
            const node = list.find(2);
            assert.equal(node.value, 2);
            assert.equal(node.next.value, 3);
            assert.equal(node.prev.value, 1); // added test for double link list 
        })
        it("should be able to delete", () => {
            const list = new DoubleLinkedList([1, 2, 3, 4]);
            assert.equal(list.front.next.next.value, 3);
            list.delete(3);
            assert.equal(list.size, 3);
            assert.equal(list.front.next.next.value, 4);
        })
        it("should be able to insert", () => {
            const list = new DoubleLinkedList([1, 2, 3, 4]);
            list.insert(3);
            assert.deepStrictEqual(Array.from(list), [3, 1, 2, 3, 4], "first insert failed");
            list.insert(45, 4);
            assert.deepStrictEqual(Array.from(list), [3, 1, 2, 3, 45, 4], "second insert failed");
        })
    })
});