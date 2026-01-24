class ListNode<T> {
    constructor(public value: T) { }
    next: ListNode<T> | undefined;
}

interface ILinkedList<T, INode> extends Iterable<T> {
    get size(): number;
    append(value: T): void;
    delete(value: T): void;
    insert(value: T, target?: T): void;
    find(value: T): INode | undefined;
}

export class LinkedList<T> implements ILinkedList<T, ListNode<T>> {
    front: ListNode<T> | undefined;
    rear: ListNode<T> | undefined;

    private _size = 0;
    get size() { return this._size }
    increase() { this._size++ }
    decrease() { this._size-- }

    constructor(arr: T[] = []) {
        arr.forEach(value => this.append(value));
    }

    *[Symbol.iterator](): Iterator<T, any, any> {
        let target = this.front;
        while (target)
        {
            yield target.value;
            target = target.next;
        }
    }

    private create(value: T) {
        const node = new ListNode<T>(value);
        if (!this.front) this.front = node;
        if (!this.rear) this.rear = node;

        return node;
    }
    private findPrev(value: T) {
        let target = this.front;
        let parent: ListNode<T> | undefined;
        while (target !== undefined && target.value !== value)
        {
            parent = target;
            target = target.next;
        }

        if (target?.value === value) return parent;
        return undefined;
    }

    append(value: T): void {
        const node = this.create(value);

        this.rear!.next = node;
        this.rear = node;
        this._size++;
    }
    insert(value: T, target?: T | undefined): void {
        const node = this.create(value);

        const parent = target ? this.findPrev(target) : undefined;

        if (parent)
        {
            node.next = parent.next?.next;
            parent.next = node;
        }
        else 
        {
            // insert as new front 
            node.next = this.front;
            this.front = node;
        }
        this._size++;
    }
    delete(value: T) {
        const parent = this.findPrev(value) ?? this.front;
        if (!parent) throw new Error("parent could not be find");
        this._size--;
        parent.next = parent.next?.next;
    }
    find(value: T) {
        const parent = this.findPrev(value);
        if (parent) return parent.next;
    }
}


class DoubleNode<T> {
    constructor(public value: T) { }

    prev: DoubleNode<T> | undefined;
    next: DoubleNode<T> | undefined;
}

export class DoubleLinkedList<T> implements ILinkedList<T, DoubleNode<T>> {
    front: DoubleNode<T> | undefined;
    rear: DoubleNode<T> | undefined;

    private _size = 0;
    get size() { return this._size }
    increase() { this._size++ }
    decrease() { this._size-- }

    constructor(arr: T[] = []) {
        arr.forEach(value => this.append(value));
    }

    *[Symbol.iterator](): Iterator<T, any, any> {
        let target = this.front;
        while (target)
        {
            yield target.value;
            target = target.next;
        }
    }

    private create(value: T): [DoubleNode<T>, boolean] {
        const node = new DoubleNode<T>(value);

        let assigned = false;
        if (!this.front) { this.front = node; assigned = true }
        if (!this.rear) { this.rear = node; assigned = true }

        return [node, assigned];
    }

    find(value: T) {
        let starget = this.front;
        let etarget = this.rear;
        while (starget && etarget)
        {
            if (starget.value === value) return starget;
            if (etarget.value === value) return etarget;

            starget = starget.next;
            etarget = etarget.prev;
        }
    }
    /**
     * this method will insert before a target, if target is undefined 
     * the new node will be inserted before the front 
     * @param value T
     * @param target T | undefined
     */
    insert(value: T, target?: T) {
        const _target = target === undefined ? this.front : this.find(target);
        if (!_target) throw new Error("could not find the node to insert target");

        const [node, assigned] = this.create(value);
        this._size++;
        if (assigned) return;

        node.next = _target;
        node.prev = _target.prev;

        if (node.prev) node.prev.next = node;
        if (node.next) node.next.prev = node;

        if (_target === this.front) this.front = node;
    }
    append(value: T): void {
        const [node, assigned] = this.create(value);
        this._size++;
        if (assigned) return;

        node.prev = this.rear;
        this.rear!.next = node;
        this.rear = node;
    }
    delete(value: T): void {
        const node = this.find(value);
        if (!node) throw new Error("could not find node to be deleted");

        if (node.prev) node.prev.next = node.next;
        if (node.next) node.next.prev = node.prev;

        if (node === this.front) this.front = node.next;
        if (node === this.rear) this.rear = node.prev;
        this._size--;
    }
}