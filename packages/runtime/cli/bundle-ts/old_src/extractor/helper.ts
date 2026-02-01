import ts from "typescript";

export function getCanonicalSymbol(
    checker: ts.TypeChecker,
    symbol: ts.Symbol
): ts.Symbol {
    return symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;
}

export function getSymbol(node: ts.Node, checker: ts.TypeChecker) {
    if (ts.isTypeAliasDeclaration(node))
    {
        return checker.getSymbolAtLocation(node.name);
    }

    if (ts.isInterfaceDeclaration(node))
    {
        return checker.getSymbolAtLocation(node.name);
    }

    if (ts.isVariableStatement(node))
    {
        const decl = node.declarationList.declarations[0];
        return checker.getSymbolAtLocation(decl.name);
    }

    if (ts.isClassDeclaration(node))
    {
        // class Foo { ... }
        if (node.name)
        {
            return checker.getSymbolAtLocation(node.name);
        }
    }

    if (ts.isFunctionDeclaration(node))
    {
        // function foo() { ... }
        if (node.name)
        {
            return checker.getSymbolAtLocation(node.name);
        }
    }

    if (ts.isEnumDeclaration(node))
    {
        // enum Foo { ... }
        return checker.getSymbolAtLocation(node.name);
    }

    if (ts.isModuleDeclaration(node))
    {
        // namespace Foo { ... } or declare module "foo" { ... }
        return checker.getSymbolAtLocation(node.name);
    }

    return checker.getSymbolAtLocation(node);
}

export type Data = {
    imports: {
        data: ts.ImportDeclaration[],
        seen: Set<ts.ImportDeclaration>,
        external: Set<ts.ImportDeclaration>,
    },
    exports: {
        data: Array<{ node: ts.Statement | ts.Declaration, sourceFile: ts.SourceFile }>,
        seen: Set<ts.Symbol>,
    },
    types: {
        data: Array<{ node: ts.Node, sourceFile: ts.SourceFile }>,
        seen: Set<ts.Symbol>,
    },
};
