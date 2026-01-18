// import statements 

import { LinkedList } from "./LinkedList";

export class Queue<T> {
    private list: LinkedList<T>;
    constructor(arr: T[]) {
        this.list = new LinkedList(arr);
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
    toArray() {
        return this.list.toArray();
    }
}