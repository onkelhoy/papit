import {describe, it, beforeEach} from "node:test";
import assert from "node:assert";
import {Queue} from "@papit/data-structure";

describe('Queue', () => {
    it("should create from array", () => {
        const queue = new Queue([1, 2, 3, 4]);
        assert.equal(queue.size, 4);
    })
    it("should generate array", () => {
        const queue = new Queue([1, 2, 3, 4]);
        assert.deepStrictEqual(Array.from(queue), [1, 2, 3, 4]);
    })
    it("should peek", () => {
        const queue = new Queue([1, 2, 3, 4]);
        assert.equal(queue.peek(), 1);
        assert.equal(queue.size, 4);
    })
    it("should enqueue", () => {
        const queue = new Queue();
        queue.enqueue(1);
        assert.equal(queue.peek(), 1);
        queue.enqueue(2);
        assert.equal(queue.size, 2);
        assert.equal(queue.peek(), 1);
    })
    it("should dequeue", () => {
        const queue = new Queue([1, 2, 3, 4]);
        assert.equal(queue.dequeue(), 1);
        assert.equal(queue.size, 3);
    })
});

