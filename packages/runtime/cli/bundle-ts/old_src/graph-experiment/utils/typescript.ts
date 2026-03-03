import ts from "typescript";

export class TS {

    static RENAME_MAP = new Map<ts.Identifier, string>();

    static init(
        location: string,
        files: string[],
        options: ts.CompilerOptions = {},
        printerOptions?: ts.PrinterOptions,
    ) {
        TS._location = location;
        TS._sources = [];

        TS._host = ts.createCompilerHost(options);

        // preventing file emit and only into memory 
        TS._host.writeFile = (fileName, content) => {
            TS._sources.push({
                source: ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true),
                entry: files.includes(fileName.replace(/.d.ts\w?/, ".ts")),
            });
        };

        TS._program = ts.createProgram({
            rootNames: files,
            options: { declaration: true, emitDeclarationOnly: true, ...options },
            host: TS._host,
        });

        TS._checker = TS._program.getTypeChecker();
        TS._program.emit();

        TS._printer = ts.createPrinter(printerOptions, {
            onEmitNode(hint, node, emitCallback) {
                // called for every node before it's printed
                // you can modify behavior or skip nodes

                emitCallback(hint, node);
            },

            substituteNode(hint, node) {
                // called for every node — return a DIFFERENT node to print instead
                // this is your rename hook
                // if (ts.isIdentifier(node) && renameMap.has(node.text)) {
                //     return ts.factory.createIdentifier(renameMap.get(node.text)!);
                // }

                // return ts.factory.createIdentifier();
                
                if (ts.isIdentifier(node))
                {
                    const renamed = TS.RENAME_MAP.get(node);
                    if (renamed)
                    {
                        return ts.factory.createIdentifier(renamed);
                    }
                }

                return node;
            },
        });
    }

    private static _printer: ts.Printer;
    static get printer() {
        return TS._printer;
    }

    private static _host: ts.CompilerHost;
    static get host() {
        return TS._host;
    }

    private static _program: ts.Program;
    static get program() {
        return TS._program;
    }

    private static _checker: ts.TypeChecker;
    static get checker() {
        return TS._checker;
    }

    private static _location: string;
    static get location() {
        return TS._location;
    }

    private static _sources: { source: ts.SourceFile, entry: boolean }[];
    static get sources() {
        return TS._sources;
    }
}