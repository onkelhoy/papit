import { Queue } from "queue";

class Node<ID = string> {
    constructor(
        public id: ID
    ) { }
}

class Edge<Type, ID> {
    constructor(
        public type: Type,
        public from: ID,
        public to: ID,
    ) { }
}

class Graph<N extends Node<ID>, ID = string, EdgeType = string> {

    nodes: Map<ID, N> = new Map();
    edges: Edge<EdgeType, ID>[] = [];
    outgoing: Map<ID, Edge<EdgeType, ID>[]> = new Map();
    incoming: Map<ID, Edge<EdgeType, ID>[]> = new Map();

    constructor(
        private strict = true
    ) { }

    get(id: ID) { return this.nodes.get(id) }

    addNode(node: N): this {
        this.nodes.set(node.id, node);
        return this;
    }

    subgraph(ids: ID[]): Graph<N, ID, EdgeType> {
        const set = new Set(ids);
        const sub = new Graph<N, ID, EdgeType>(this.strict);

        for (const id of ids)
        {
            const node = this.nodes.get(id);
            if (node)
            {
                sub.nodes.set(id, node);
            }
        }

        for (const edge of this.edges)
        {
            if (set.has(edge.from) && set.has(edge.to))
            {
                sub.addEdge(edge.from, edge.to, edge.type);
            }
        }

        return sub;
    }

    addEdge(from: ID, to: ID, type: EdgeType) {
        const fromNode = this.get(from);
        const toNode = this.get(to);

        if (!fromNode) throw new Error("from node does not exist");
        if (!toNode) throw new Error("to node does not exist");

        const edge = new Edge(type, from, to);

        this.edges.push(edge);

        if (!this.outgoing.has(from)) this.outgoing.set(from, []);
        if (!this.incoming.has(to)) this.incoming.set(to, []);

        this.outgoing.get(from)!.push(edge);
        this.incoming.get(to)!.push(edge);
    }

    private bfs(direction: "outgoing" | "incoming", start: ID, typeFilter?: EdgeType[]): N[] {
        const visited = new Set<ID>();
        const queue: ID[] = [start];
        const result: N[] = [];

        visited.add(start);

        while (queue.length > 0)
        {
            const current = queue.shift()!;
            const edges = this[direction].get(current) ?? [];

            for (const edge of edges)
            {
                if (typeFilter && !typeFilter.includes(edge.type)) continue;

                const next = direction === "outgoing" ? edge.to : edge.from;
                if (visited.has(next)) continue;

                visited.add(next);
                queue.push(next);
                result.push(this.get(next)!);
            }
        }

        return result;
    }

    toposort(typeFilter?: EdgeType[]) {
        const visited = new Set<ID>();
        const visiting = new Set<ID>();
        const result: ID[] = [];

        const visit = (id: ID) => {
            if (visited.has(id)) return;

            if (visiting.has(id))
            {
                // Cycle detected
                if (!this.strict)
                {
                    // In non-strict mode, still add the node but skip further processing
                    if (!visited.has(id))
                    {
                        visited.add(id);
                        result.push(id);
                    }
                    return;
                }
                throw new Error("Cycle detected");
            }

            visiting.add(id);

            for (const edge of this.outgoing.get(id) ?? [])
            {
                if (typeFilter && !typeFilter.includes(edge.type)) continue;
                visit(edge.to);
            }

            visiting.delete(id);

            if (!visited.has(id))
            {
                visited.add(id);
                result.push(id);
            }
        };

        for (const id of this.nodes.keys())
        {
            if (!visited.has(id))
            {
                visit(id);
            }
        }

        return result.reverse();
    }

    descendants(start: ID, typeFilter?: EdgeType[]): N[] {
        return this.bfs("outgoing", start, typeFilter);
    }

    ancestors(start: ID, typeFilter?: EdgeType[]): N[] {
        return this.bfs("incoming", start, typeFilter);
    }
}


export {
    Graph,
    Edge as GraphEdge,
    Node as GraphNode,
}