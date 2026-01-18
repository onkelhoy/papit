export class TreeNode<T> {
    private _children: TreeNode<T>[] = [];
    constructor(public value: T, public parent?: TreeNode<T>) {
        if (this.parent) this.parent._children.push(this);
    }

    get children() {
        return this._children;
    }

    /** Returns all leaf nodes in this subtree */
    getLeaves(leafs: TreeNode<T>[] = []): TreeNode<T>[] {
        if (this.children.length === 0) leafs.push(this);
        else this.children.forEach(child => child.getLeaves(leafs));
        return leafs;
    }

    /** Depth-first traversal; return true in fn to stop early */
    traverseDepthFirst(fn: (node: TreeNode<T>) => boolean | void) {
        if (fn(this)) return true;
        for (const child of this.children)
        {
            if (child.traverseDepthFirst(fn)) return true;
        }
    }

    /** Breadth-first traversal; return true in fn to stop early */
    traverseBreadthFirst(fn: (node: TreeNode<T>) => boolean | void) {
        const queue: TreeNode<T>[] = [this];
        while (queue.length > 0)
        {
            const node = queue.shift()!;
            if (fn(node)) return;
            queue.push(...node.children);
        }
    }

    /** Number of nodes in this subtree (including this node) */
    size(): number {
        let count = 1; // count self
        for (const child of this.children) count += child.size();
        return count;
    }

    /** Height of this node (max depth of subtree) */
    height(): number {
        if (this.children.length === 0) return 0;
        return 1 + Math.max(...this.children.map(c => c.height()));
    }
}

export class Tree<T> {
    root?: TreeNode<T>;

    /** Returns all leaf nodes in the tree */
    getLeaves(): TreeNode<T>[] {
        return this.root?.getLeaves() ?? [];
    }

    /** Adds a new node under the specified parent (or root if omitted) */
    append(value: T, parent?: TreeNode<T>): TreeNode<T> {
        if (!this.root)
        {
            this.root = new TreeNode(value);
            return this.root;
        }
        return new TreeNode(value, parent ?? this.root);
    }

    /** Deletes a node (and its subtree) by value */
    delete(value: T) {
        if (!this.root) throw new Error("Tree is empty");

        // Handle root deletion
        if (this.root.value === value)
        {
            this.root = undefined;
            return;
        }

        const node = this.findNode(value);
        if (!node) throw new Error("TreeNode not found");
        const index = node.parent?.children.findIndex(child => child === node);
        if (index !== undefined && index >= 0) node.parent!.children.splice(index, 1);
    }

    /** Finds the first node with the given value using DFS */
    findNode(value: T): TreeNode<T> | undefined {
        if (!this.root) return undefined;
        let found: TreeNode<T> | undefined;
        this.root.traverseDepthFirst(node => {
            if (node.value === value)
            {
                found = node;
                return true; // stop traversal
            }
        });
        return found;
    }

    /** Total number of nodes in the tree */
    size(): number {
        return this.root?.size() ?? 0;
    }

    /** Height of the tree (root = 0 if no children) */
    height(): number {
        return this.root?.height() ?? 0;
    }
}