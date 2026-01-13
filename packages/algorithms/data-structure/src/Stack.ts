export class Stack<T> {
    constructor(private arr: T[] = []) { }

    get size() { return this.arr.length }
    peek() { return this.arr[this.arr.length - 1] }
    pop() { return this.arr.pop() }
    push(value: T) { this.arr.push(value) }
    toArray() { return [...this.arr] }
}