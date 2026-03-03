import ts from "typescript";
import { TS } from "graph-experiment/utils/typescript";
import { Node } from "graph-experiment/node";
import { logger } from "graph-experiment/utils/logger";

const { log } = logger("map");

export type Item = { nodes: Node[], entry: boolean, source: ts.SourceFile };
export class NodeMap {
    private static map: Map<string, Item> = new Map();

    static init() {
        for (const item of TS.sources) 
        {
            const nodes = item.source.statements.map(stmt => this.createNode(stmt, item.source));
            
            this.map.set(item.source.fileName, {
                entry: item.entry,
                source: item.source,
                nodes,
            });
        }
    }

    static toArray() {
        return Array.from(this.map.values());
    }

    static findByStatement(statement: ts.Statement) {
        const source = statement.getSourceFile();
        const filename = source.fileName;

        // const node = new Node(statement, source);
        const set = this.map.get(filename);
        if (!set) return null;

        return set.nodes.find(node => node.statement === statement);
        
        // return this.nodes.find(node => node.statement === statement && node.source === source);
    }
    static find(identity: string, filename: string) {
        const set = this.map.get(filename.replace(/\.ts$/, '.d.ts'));
        if (!set) return null;

        // we first check based on identity 
        return set.nodes.find(node => node.identity?.text === identity || node.uses.some(u => u.text === identity));
    }

    private static createNode (statement: ts.Statement, source: ts.SourceFile) {
        const node = new Node(statement, source);

        // log(node.print());

        return node;
    }

}