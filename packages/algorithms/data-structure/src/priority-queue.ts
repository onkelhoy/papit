// with heap 
export class PriorityQueue<T> implements Iterable<T> {
    *[Symbol.iterator](): Iterator<T, any, any> {
        const copy = new PriorityQueue<T>();
        copy.heap = this.heap.map(e => ({ ...e }));

        while (copy.size > 0)
        {
            yield copy.dequeue()!;
        }
    }

    private heap: { value: T; priority: number }[] = [];

    get size() {
        return this.heap.length;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    enqueue(value: T, priority: number) {
        this.heap.push({ value, priority });
        this.bubbleUp();
    }

    dequeue(): T | undefined {
        if (this.heap.length === 0) return undefined;

        const root = this.heap[0];
        const last = this.heap.pop()!;

        if (this.heap.length > 0)
        {
            this.heap[0] = last;
            this.bubbleDown();
        }

        return root.value;
    }

    peek(): T | undefined {
        return this.heap[0]?.value;
    }

    peekWithPriority(): { value: T; priority: number } | undefined {
        return this.heap[0];
    }

    private bubbleUp() {
        let i = this.heap.length - 1;

        while (i > 0)
        {
            const p = Math.floor((i - 1) / 2);
            if (this.heap[p].priority <= this.heap[i].priority) break;

            [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
            i = p;
        }
    }

    private bubbleDown() {
        let i = 0;

        while (true)
        {
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            let smallest = i;

            if (
                left < this.heap.length &&
                this.heap[left].priority < this.heap[smallest].priority
            )
            {
                smallest = left;
            }

            if (
                right < this.heap.length &&
                this.heap[right].priority < this.heap[smallest].priority
            )
            {
                smallest = right;
            }

            if (smallest === i) break;

            [this.heap[i], this.heap[smallest]] = [
                this.heap[smallest],
                this.heap[i],
            ];

            i = smallest;
        }
    }
}
