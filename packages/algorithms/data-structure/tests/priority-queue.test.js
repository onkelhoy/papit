import {describe, it} from "node:test";
import assert from "node:assert";

import {PriorityQueue} from "@papit/data-structure";

describe("PriorityQueue", () => {
    it("should start empty", () => {
        const pq = new PriorityQueue();
        assert.equal(pq.size, 0);
        assert.equal(pq.peek(), undefined);
    });

    it("should enqueue items", () => {
        const pq = new PriorityQueue();
        pq.enqueue("a", 2);
        pq.enqueue("b", 1);

        assert.equal(pq.size, 2);
    });

    it("should peek lowest priority value", () => {
        const pq = new PriorityQueue();
        pq.enqueue("a", 10);
        pq.enqueue("b", 1);
        pq.enqueue("c", 5);

        assert.equal(pq.peek(), "b");
        assert.equal(pq.size, 3);
    });

    it("should dequeue in priority order", () => {
        const pq = new PriorityQueue();
        pq.enqueue("a", 3);
        pq.enqueue("b", 1);
        pq.enqueue("c", 2);

        assert.equal(pq.dequeue(), "b");
        assert.equal(pq.dequeue(), "c");
        assert.equal(pq.dequeue(), "a");
        assert.equal(pq.dequeue(), undefined);
    });

    it("should maintain heap after multiple operations", () => {
        const pq = new PriorityQueue();
        pq.enqueue(1, 5);
        pq.enqueue(2, 1);
        pq.enqueue(3, 3);

        assert.equal(pq.dequeue(), 2);

        pq.enqueue(4, 0);
        assert.equal(pq.peek(), 4);
        assert.equal(pq.dequeue(), 4);
        assert.equal(pq.dequeue(), 3);
        assert.equal(pq.dequeue(), 1);
    });

    it("toArray should return heap order (not sorted)", () => {
        const pq = new PriorityQueue();
        pq.enqueue("a", 2);
        pq.enqueue("b", 1);
        pq.enqueue("c", 3);

        const arr = Array.from(pq);
        assert.equal(arr.length, 3);
        assert.ok(arr.includes("a"));
        assert.ok(arr.includes("b"));
        assert.ok(arr.includes("c"));
    });
});
