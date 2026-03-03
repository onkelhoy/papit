import ts from "typescript";

export function getResolvedPath(program: ts.Program, node: ts.ImportDeclaration | ts.ExportDeclaration) {
    const moduleSpecifier = node.moduleSpecifier;
    if (!moduleSpecifier) return null;
    if (!ts.isStringLiteral(moduleSpecifier)) return null;

    const importPath = moduleSpecifier.text;

    // Resolve where this import actually points to
    const resolvedModule = ts.resolveModuleName(
        importPath,
        node.getSourceFile().fileName,
        program.getCompilerOptions(),
        ts.sys
    );

    return resolvedModule.resolvedModule?.resolvedFileName;
}