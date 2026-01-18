export class GraphNode<T> {
    edges: Set<GraphNode<T>> = new Set();
    constructor(public value: T) { }
}

export class Graph<T> {
    nodes: Map<T, GraphNode<T>> = new Map();

    addNode(value: T): GraphNode<T> {
        if (!this.nodes.has(value))
        {
            this.nodes.set(value, new GraphNode(value));
        }
        return this.nodes.get(value)!;
    }

    addEdge(from: T, to: T) {
        const fromNode = this.addNode(from);
        const toNode = this.addNode(to);
        fromNode.edges.add(toNode);
    }

    // Topological sort (returns nodes in dependency order)
    topologicalSort(): T[] {
        const visited = new Set<GraphNode<T>>();
        const temp = new Set<GraphNode<T>>();
        const result: T[] = [];

        const visit = (node: GraphNode<T>) => {
            if (temp.has(node)) throw new Error("Cycle detected");
            if (!visited.has(node))
            {
                temp.add(node);
                node.edges.forEach(visit);
                temp.delete(node);
                visited.add(node);
                result.push(node.value);
            }
        };

        this.nodes.forEach(visit);
        return result.reverse(); // dependencies first
    }
}
