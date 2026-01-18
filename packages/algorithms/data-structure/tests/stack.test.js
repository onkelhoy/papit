import {describe, it, beforeEach} from "node:test";
import assert from "node:assert";
import {Stack} from "@papit/data-structure";

describe('Stack', () => {
    it("should create from array", () => {
        const stack = new Stack([1, 2, 3, 4]);
        assert.equal(stack.size, 4);
    })
    it("should generate array", () => {
        const stack = new Stack([1, 2, 3, 4]);
        assert.deepStrictEqual(stack.toArray(), [1, 2, 3, 4]);
    })
    it("should push", () => {
        const stack = new Stack();
        stack.push(1);
        stack.push(1);
        assert.equal(stack.size, 2);
        stack.push(1);
        assert.equal(stack.size, 3);
    })
    it("should peek", () => {
        const stack = new Stack([1, 2, 3, 4]);
        assert.equal(stack.peek(), 4);
        assert.equal(stack.size, 4);
    })
    it("should pop", () => {
        const stack = new Stack([1, 2, 3, 4]);
        assert.equal(stack.pop(), 4);
        assert.equal(stack.size, 3);
    })
});