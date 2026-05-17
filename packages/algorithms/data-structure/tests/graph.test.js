import {describe, it, beforeEach} from "node:test";
import assert from "node:assert";
import {Graph, GraphNode} from "@papit/data-structure";

function makeGraph() {
    return new Graph();
}

function add(graph, ...ids) {
    for (const id of ids) graph.addNode(new GraphNode(id));
}

describe("Graph", () => {
    let graph;

    beforeEach(() => {graph = makeGraph()});

    describe("nodes", () => {
        it("should add nodes", () => {
            add(graph, "A", "B");
            assert.ok(graph.nodes.has("A"));
            assert.ok(graph.nodes.has("B"));
            assert.equal(graph.nodes.size, 2);
        });

        it("should return node by id", () => {
            add(graph, "A");
            assert.equal(graph.get("A")?.id, "A");
            assert.equal(graph.get("Z"), undefined);
        });
    });

    describe("edges", () => {
        it("should add edges and populate outgoing/incoming maps", () => {
            add(graph, "A", "B");
            // B is a dependency of A: edge B → A
            graph.addEdge("B", "A", "dependency");

            assert.equal(graph.edges.length, 1);
            assert.equal(graph.outgoing.get("B")?.length, 1);
            assert.equal(graph.incoming.get("A")?.length, 1);
            assert.equal(graph.outgoing.get("A"), undefined);
        });

        it("should throw when from-node is missing", () => {
            add(graph, "A");
            assert.throws(() => graph.addEdge("Z", "A", "dependency"), /from node does not exist/);
        });

        it("should throw when to-node is missing", () => {
            add(graph, "A");
            assert.throws(() => graph.addEdge("A", "Z", "dependency"), /to node does not exist/);
        });

        it("should filter by edge type in outgoing lookup", () => {
            add(graph, "A", "B", "C");
            graph.addEdge("B", "A", "dependency");
            graph.addEdge("C", "A", "peer");

            const depEdges = (graph.outgoing.get("B") ?? []).filter(e => e.type === "dependency");
            const peerEdges = (graph.outgoing.get("C") ?? []).filter(e => e.type === "peer");
            assert.equal(depEdges.length, 1);
            assert.equal(peerEdges.length, 1);
        });
    });

    describe("toposort", () => {
        it("should return all nodes for disconnected graph", () => {
            add(graph, "X", "Y", "Z");
            const order = graph.toposort();
            assert.equal(order.length, 3);
            assert.ok(order.includes("X"));
            assert.ok(order.includes("Y"));
            assert.ok(order.includes("Z"));
        });

        it("should place dependencies before dependents", () => {
            // D ← B ← A, D ← C ← A  (D is a dep of B and C, B/C are deps of A)
            add(graph, "A", "B", "C", "D");
            graph.addEdge("D", "B", "dependency");
            graph.addEdge("D", "C", "dependency");
            graph.addEdge("B", "A", "dependency");
            graph.addEdge("C", "A", "dependency");

            const order = graph.toposort();
            assert.ok(order.indexOf("D") < order.indexOf("B"), "D before B");
            assert.ok(order.indexOf("D") < order.indexOf("C"), "D before C");
            assert.ok(order.indexOf("B") < order.indexOf("A"), "B before A");
            assert.ok(order.indexOf("C") < order.indexOf("A"), "C before A");
        });

        it("should detect cycles", () => {
            add(graph, "A", "B", "C");
            graph.addEdge("A", "B", "dependency");
            graph.addEdge("B", "C", "dependency");
            graph.addEdge("C", "A", "dependency");

            assert.throws(() => graph.toposort(), /Cycle detected/);
        });

        it("should respect typeFilter — ignored edge types do not affect order", () => {
            add(graph, "A", "B", "C");
            // B is a hard dep of A
            graph.addEdge("B", "A", "dependency");
            // C is only a peer dep of A — excluded by filter
            graph.addEdge("C", "A", "peer");

            const order = graph.toposort(["dependency"]);
            assert.ok(order.indexOf("B") < order.indexOf("A"), "B before A");
            // C is still in the result (it's a node), just unconstrained
            assert.ok(order.includes("C"));
        });
    });

    describe("ancestors / descendants", () => {
        // Dependency chain: D ← B ← A  and  D ← C ← A
        // Edge direction: dependency → dependent
        beforeEach(() => {
            add(graph, "A", "B", "C", "D");
            graph.addEdge("D", "B", "dependency"); // B depends on D
            graph.addEdge("D", "C", "dependency"); // C depends on D
            graph.addEdge("B", "A", "dependency"); // A depends on B
            graph.addEdge("C", "A", "dependency"); // A depends on C
        });

        it("ancestors(A) = all things A depends on transitively", () => {
            const anc = graph.ancestors("A").map(n => n.id);
            assert.ok(anc.includes("B"), "B");
            assert.ok(anc.includes("C"), "C");
            assert.ok(anc.includes("D"), "D");
            assert.equal(anc.length, 3);
        });

        it("ancestors(D) = nothing (D has no dependencies)", () => {
            assert.equal(graph.ancestors("D").length, 0);
        });

        it("descendants(D) = everything that depends on D transitively", () => {
            const desc = graph.descendants("D").map(n => n.id);
            assert.ok(desc.includes("B"), "B");
            assert.ok(desc.includes("C"), "C");
            assert.ok(desc.includes("A"), "A");
            assert.equal(desc.length, 3);
        });

        it("descendants(A) = nothing (nothing depends on A)", () => {
            assert.equal(graph.descendants("A").length, 0);
        });

        it("typeFilter excludes edges of wrong type", () => {
            add(graph, "E");
            graph.addEdge("E", "A", "peer"); // only peer, not dependency

            const anc = graph.ancestors("A", ["dependency"]).map(n => n.id);
            assert.ok(!anc.includes("E"), "E excluded by filter");
        });
    });

    describe("subgraph", () => {
        beforeEach(() => {
            add(graph, "A", "B", "C", "D");
            graph.addEdge("D", "C", "dependency");
            graph.addEdge("C", "B", "dependency");
            graph.addEdge("B", "A", "dependency");
        });

        it("should include only specified nodes", () => {
            const sub = graph.subgraph(["A", "B", "C"]);
            assert.ok(sub.nodes.has("A"));
            assert.ok(sub.nodes.has("B"));
            assert.ok(sub.nodes.has("C"));
            assert.ok(!sub.nodes.has("D"));
        });

        it("should include only edges between nodes in the set", () => {
            const sub = graph.subgraph(["A", "B", "C"]);
            // C→B and B→A are in set, D→C is not
            assert.equal(sub.edges.length, 2);
        });

        it("subgraph toposort respects internal edges only", () => {

            const descendants = graph.descendants("D");
            const desc = descendants.map(n => n.id).concat("D");
            const sub = graph.subgraph(desc);
            const order = sub.toposort();

            assert.ok(order.indexOf("D") < order.indexOf("C"), "D before C");
            assert.ok(order.indexOf("C") < order.indexOf("B"), "C before B");
            assert.ok(order.indexOf("B") < order.indexOf("A"), "B before A");
        });

        it("should handle unknown ids gracefully", () => {
            const sub = graph.subgraph(["A", "NOPE"]);
            assert.ok(sub.nodes.has("A"));
            assert.ok(!sub.nodes.has("NOPE"));
        });
    });
});