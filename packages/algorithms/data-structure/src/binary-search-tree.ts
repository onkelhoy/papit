export class BSTNode<T> {
    left: BSTNode<T> | undefined;
    right: BSTNode<T> | undefined;
    parent: BSTNode<T> | undefined;

    constructor(public value: T) { }
}

export class BinarySearchTree<T> {
    root: BSTNode<T> | undefined;

    private compare(a: T, b: T): number {
        if (typeof a === "string") return a.localeCompare(b as string);
        if (typeof a === "number") return a - (b as number);
        if (typeof (a as any)?.compareTo === "function")
            return (a as any).compareTo(b);
        throw new Error("value is not comparable");
    }

    private replace(oldNode: BSTNode<T>, newNode?: BSTNode<T>) {
        if (!oldNode.parent)
        {
            this.root = newNode;
        }
        else if (oldNode.parent.left === oldNode)
        {
            oldNode.parent.left = newNode;
        }
        else
        {
            oldNode.parent.right = newNode;
        }

        if (newNode)
        {
            newNode.parent = oldNode.parent;
        }

        oldNode.parent = undefined;
        oldNode.left = undefined;
        oldNode.right = undefined;
    }



    contains(value: T): boolean {
        return this.find(value) !== undefined;
    }

    min(start = this.root): BSTNode<T> | undefined {
        let current = start;
        while (current?.left) current = current.left;
        return current;
    }

    max(start = this.root): BSTNode<T> | undefined {
        let current = start;
        while (current?.right) current = current.right;
        return current;
    }

    find(value: T, compare?: (a: T, b: T) => number): BSTNode<T> | undefined {
        let current = this.root;

        while (current)
        {
            const cmp = compare ? compare(value, current.value) : this.compare(value, current.value);

            if (cmp === 0) return current;
            current = cmp < 0 ? current.left : current.right;
        }

        return undefined;
    }

    insert(value: T): BSTNode<T> {
        const node = new BSTNode(value);

        if (!this.root)
        {
            this.root = node;
            return node;
        }

        let current = this.root;

        while (true)
        {
            if (this.compare(node.value, current.value) < 0)
            {
                if (!current.left)
                {
                    current.left = node;
                    node.parent = current;
                    return node;
                }
                current = current.left;
            }
            else
            {
                if (!current.right)
                {
                    current.right = node;
                    node.parent = current;
                    return node;
                }
                current = current.right;
            }
        }
    }

    delete(value: T): boolean {
        const node = this.find(value);
        if (!node) return false;

        // Case 1: leaf
        if (!node.left && !node.right)
        {
            this.replace(node);
        }

        // Case 2: one child
        else if (!node.left)
        {
            this.replace(node, node.right);
        }
        else if (!node.right)
        {
            this.replace(node, node.left);
        }

        // Case 3: two children
        else
        {
            const successor = this.min(node.right)!;

            // Copy successor value
            node.value = successor.value;

            // Remove successor (it has at most one child)
            if (successor.right)
            {
                this.replace(successor, successor.right);
            } else
            {
                this.replace(successor);
            }
        }

        return true;
    }

    private preDFS(order: T[], target?: BSTNode<T>) {
        if (!target) return order;

        // Pre-order: root, left, right
        order.push(target.value);
        this.preDFS(order, target.left);
        this.preDFS(order, target.right);

        return order;
    }

    private postDFS(order: T[], target?: BSTNode<T>) {
        if (!target) return order;

        // Post-order: left, right, root
        this.postDFS(order, target.left);
        this.postDFS(order, target.right);
        order.push(target.value);

        return order;
    }

    private inDFS(order: T[], target?: BSTNode<T>) {
        if (!target) return order;

        // In-order: left, root, right
        this.inDFS(order, target.left);
        order.push(target.value);
        this.inDFS(order, target.right);

        return order;
    }

    DFS(type: "pre" | "post" | "in" = "pre") {
        const order: T[] = [];

        switch (type)
        {
            case "pre":
                this.preDFS(order, this.root);
                break;
            case "post":
                this.postDFS(order, this.root);
                break;
            case "in":
                this.inDFS(order, this.root);
                break;
        }

        return order;
    }
}