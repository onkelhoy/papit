import ts from "typescript";
import { logger } from "graph-experiment/utils/logger";
import { TS } from "graph-experiment/utils/typescript";
import { Area } from "./area";

const { log } = logger("node");

export type NodeType = "export"|"fxport"|"type"|"import";
export class Node { 

    identity: ts.Identifier|null = null;
    type!: NodeType;
    uses: ts.Identifier[] = [];

    import: ReturnType<typeof Area['getImport']> = null;
    fxport: ReturnType<typeof Area['getFxport']> = null;

    stamps = new Set<string>();

    constructor(public statement: ts.Statement, public source: ts.SourceFile) 
    {
        // log("created, now we must check what it is, import, export etc");

        const flags = {
            export: false,
            import: false,
            from: false,
        }

        if (ts.isExportDeclaration(this.statement)) {
            flags.export = true;
            if (this.statement.moduleSpecifier) flags.from = true;
        }
        if (ts.isImportDeclaration(this.statement)) {
            flags.import = true;
        }
    
        const runner = (node: ts.Node, levels = 0) => {
            node.forEachChild(child => {
                if (ts.isIdentifier(child))
                {
                    if (levels === 0 && this.identity === null)
                    {
                        this.identity = child;
                    }
                    else 
                    {
                        this.uses.push(child);
                    }
                }

                const kind = ts.SyntaxKind[child.kind];
                switch (kind) 
                {
                    case "ImportKeyword":
                    case "ImportClause":
                        flags.import = true;
                        break;
                    case "ExportKeyword":
                        flags.export = true;
                        break;
                    case "FromKeyword":
                        flags.from = true;
                        break;
                }

                runner(child, levels + 1);
            });
        }
        runner(this.statement);

        if (flags.import) 
        {
            this.type = "import";
            this.import = Area.getImport(this.statement);
        }
        else if (flags.export && flags.from) 
        {
            this.type = "fxport";
            this.fxport = Area.getFxport(this.statement);
        }
        else if (flags.export) this.type = "export";
        else this.type = "type";
    }

    stamp(location: string)
    {
        this.stamps.add(location);
    }

    print() {
        return TS.printer.printNode(ts.EmitHint.Unspecified, this.statement, this.source);
    }

    toString() {
        return JSON.stringify({
            text: this.print(),
            type: this.type,
            uses: this.uses.map(i => i.text),
            import: this.import,
            fxport: this.fxport,
        }, null, 4)
    }
}

// class TypeNode extends Node {

//     name: string;
//     identifier: ts.Identifier;

//     constructor(statement: ts.Statement, source: ts.SourceFile) {
//         super(statement, source);

//         this.identifier = this.getIdentifier();
//         this.name = 
//     }
    

//     // we want to find this Statement's own identifier (if exist - like import and reexport is differnet)
//     getIdentifier() {
//         const stmt = this.statement;

//         if ("name" in stmt && stmt.name && ts.isIdentifier(stmt.name)) {
//             return stmt.name;
//         }

//         return undefined;
//     }
// }