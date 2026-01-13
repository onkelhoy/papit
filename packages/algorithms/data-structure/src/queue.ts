// import statements 

import { LinkedList } from "./linked-list";

export class Queue<T> implements Iterable<T> {
    private list: LinkedList<T>;
    constructor(arr: T[]) {
        this.list = new LinkedList(arr);
    }

    [Symbol.iterator](): Iterator<T, any, any> {
        return this.list[Symbol.iterator]();
    }

    get size() {
        return this.list.size;
    }

    enqueue(value: T) {
        this.list.append(value);
    }
    dequeue() {
        const peek = this.peek();
        this.list.decrease();
        this.list.front = this.list.front?.next;
        return peek;
    }
    peek(): T | undefined {
        return this.list.front?.value;
    }
}