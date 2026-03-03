import ts from "typescript";

export function getSource(files: string[], options: ts.CompilerOptions = {}) {
    const sources: { source: ts.SourceFile; entry: boolean }[] = [];
    const host = ts.createCompilerHost(options);

    host.writeFile = (fileName, content) => {
        sources.push({
            source: ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true),
            entry: files.includes(
                fileName.replace(/.d.ts\w?/, () => ".ts")
            ),
        });
    };

    const program = ts.createProgram({
        rootNames: files,
        options: { declaration: true, emitDeclarationOnly: true, ...options },
        host,
    });

    program.emit();
    return { sources, program, host };
}