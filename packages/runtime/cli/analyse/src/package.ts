import path from "node:path";
import fs from "node:fs";

import ts from "typescript";
import { PackageGraph, PackageNode } from "@papit/information";

import { createTypeOf, type TypeOf } from "./checker";
import { analyseCode, readImports, readTagNames } from "./code";
import type { AnalysePackageOptions, Builtin, Core, PackageAnalysis, Reference } from "./types";

type Package = {
    name: string;
    version: string;
    location: string;
    /** Absolute source folder, `undefined` when the package ships none (e.g. in node_modules). */
    src?: string;
    /** Inside node_modules: a shipped analyse.json is always trusted. */
    installed: boolean;
};

type Exported = { file: string; className: string };

/** One analysePackage run: memoised files, packages and resolved classes. */
class Analysis {
    private files = new Map<string, Core[]>();
    private exports = new Map<string, Map<string, Exported>>();
    private packages = new Map<string, Package | null>();
    private resolved = new Map<string, Core | Reference>();
    private resolving = new Set<string>();
    private checkers = new Map<string, TypeOf>();

    constructor(private reuse: boolean) { }

    run(location: string): PackageAnalysis {
        const pkg = this.open(location)!;
        const entries = this.entries(pkg);

        // tag names from customElements.define in the entry files
        const tags = new Map<string, string>();
        for (const entry of entries)
        {
            const source = this.parse(entry);
            const imports = readImports(source);
            readTagNames(source).forEach((tag, local) => tags.set(imports.get(local)?.imported ?? local, tag));
        }

        const elements: Core[] = [];
        const seen = new Set<string>();
        for (const entry of entries)
        {
            for (const exported of this.readExports(entry, pkg).values())
            {
                const key = `${exported.file}#${exported.className}`;
                if (seen.has(key)) continue;
                seen.add(key);

                const core = this.resolveClass(pkg, exported.file, exported.className);
                if (!core || !("properties" in core)) continue;

                const element = { ...core };
                element.tagName ??= tags.get(element.className);
                if (!element.tagName && !isElement(element)) continue;
                elements.push(element);
            }
        }

        return { name: pkg.name, version: pkg.version, elements };
    }

    /** The Core for `className` in `file`, with its extends chain resolved as far as possible. */
    private resolveClass(pkg: Package, file: string, className: string): Core | Reference | undefined {
        const key = `${file}#${className}`;
        if (this.resolved.has(key)) return this.resolved.get(key);
        if (this.resolving.has(key)) return { className, import: file }; // cycle

        const found = this.analyse(pkg, file).find(core => core.className === className);
        if (!found) return undefined;

        this.resolving.add(key);
        const core: Core = {
            ...found,
            source: { package: pkg.name, file: path.relative(pkg.location, file).split(path.sep).join("/") },
            extends: this.resolveParent(pkg, file, found.extends as Reference | Builtin | null),
        };
        this.resolving.delete(key);

        this.resolved.set(key, core);
        return core;
    }

    private resolveParent(pkg: Package, file: string, parent: Reference | Builtin | null): Core | Reference | Builtin | null {
        if (!parent || "builtin" in parent) return parent;

        // same file
        if (parent.import === file) return this.resolveClass(pkg, file, parent.className) ?? parent;

        const local = this.resolveModule(pkg, file, parent.import);
        if (local)
        {
            const exported = this.readExports(local, pkg).get(parent.className);
            if (!exported) return parent;
            return this.resolveClass(pkg, exported.file, exported.className) ?? parent;
        }

        const dependency = this.dependency(pkg, parent.import);
        if (!dependency) return parent;

        const stored = this.stored(dependency, parent.className);
        if (stored) return stored;
        if (!dependency.src) return parent;

        for (const entry of this.entries(dependency))
        {
            const exported = this.readExports(entry, dependency).get(parent.className);
            if (exported) return this.resolveClass(dependency, exported.file, exported.className) ?? parent;
        }
        return parent;
    }

    /** A Core from the dependency's analyse.json, when reuse allows it. */
    private stored(pkg: Package, className: string): Core | undefined {
        const file = path.join(pkg.location, "analyse.json");
        if (!fs.existsSync(file)) return undefined;

        // without src there is nothing to re-analyse; installed ones are trusted, in-repo ones only while fresh
        const use = !pkg.src || (this.reuse && (pkg.installed || fs.statSync(file).mtimeMs > newest(pkg)));
        if (!use) return undefined;

        try
        {
            const analysis = JSON.parse(fs.readFileSync(file, "utf8")) as PackageAnalysis;
            return findCore(analysis.elements, className);
        }
        catch
        {
            return undefined;
        }
    }

    // packages

    private open(location: string): Package | null {
        location = fs.realpathSync(location);
        const file = path.join(location, "package.json");
        if (!fs.existsSync(file)) return null;

        const json = JSON.parse(fs.readFileSync(file, "utf8"));
        const installed = location.split(path.sep).includes("node_modules");

        let src: string | undefined;
        try
        {
            src = path.join(location, new PackageNode(json, "local", location).sourceFolder);
        }
        catch
        {
            src = path.join(location, "src");
        }
        if (!fs.existsSync(src)) src = undefined;

        return { name: json.name, version: json.version, location, src, installed };
    }

    /** The package a bare specifier points at: the workspace first, then node_modules up from `pkg`. */
    private dependency(pkg: Package, specifier: string): Package | null {
        const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!;
        const key = `${pkg.location}|${name}`;
        if (this.packages.has(key)) return this.packages.get(key)!;

        let found: Package | null = null;
        const workspace = PackageGraph.ERROR ? undefined : PackageGraph.get(name);
        if (workspace) found = this.open(workspace.location);

        for (let dir = pkg.location; !found && dir !== path.dirname(dir); dir = path.dirname(dir))
        {
            const candidate = path.join(dir, "node_modules", name);
            if (fs.existsSync(path.join(candidate, "package.json"))) found = this.open(candidate);
        }

        this.packages.set(key, found);
        return found;
    }

    /** Source files behind package.json `exports`/`main`, mapped the way @papit/build does. */
    private entries(pkg: Package): string[] {
        if (!pkg.src) return [];

        const files = new Set<string>();
        try
        {
            const json = JSON.parse(fs.readFileSync(path.join(pkg.location, "package.json"), "utf8"));
            const { entries } = new PackageNode(json, "local", pkg.location).entrypoints;
            for (const entry of Object.values(entries))
            {
                const input = entry.import?.input ?? entry.require?.input ?? entry.types?.input;
                if (input && fs.existsSync(input)) files.add(input);
            }
        }
        catch { }

        if (files.size === 0 && fs.existsSync(path.join(pkg.src, "index.ts"))) files.add(path.join(pkg.src, "index.ts"));
        return [...files];
    }

    // modules

    /** Resolves a relative or baseUrl specifier to a source file inside `pkg`. */
    private resolveModule(pkg: Package, from: string, specifier: string): string | undefined {
        let base: string;
        if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
        else if (pkg.src) base = path.join(pkg.src, specifier);
        else return undefined;

        const stem = base.replace(/\.(m?js|ts)$/, "");
        for (const candidate of [`${stem}.ts`, `${stem}.tsx`, base, path.join(stem, "index.ts")])
        {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && candidate.startsWith(pkg.location)) return candidate;
        }
        return undefined;
    }

    /** Exported name → the file and class name that declares it, following re-exports. */
    private readExports(file: string, pkg: Package, seen = new Set<string>()): Map<string, Exported> {
        if (this.exports.has(file)) return this.exports.get(file)!;
        const result = new Map<string, Exported>();
        if (seen.has(file)) return result;
        seen.add(file);

        const source = this.parse(file);
        const imports = readImports(source);
        const local = new Set<string>();

        for (const statement of source.statements)
        {
            if (ts.isClassDeclaration(statement) && statement.name)
            {
                local.add(statement.name.text);
                const exported = ts.getModifiers(statement)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
                if (exported) result.set(statement.name.text, { file, className: statement.name.text });
            }
        }

        for (const statement of source.statements)
        {
            if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;

            const specifier = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined;
            const target = specifier ? this.resolveModule(pkg, file, specifier) : undefined;
            const targetExports = target ? this.readExports(target, pkg, seen) : undefined;

            if (!statement.exportClause)
            {
                targetExports?.forEach((value, key) => !result.has(key) && result.set(key, value));
                continue;
            }
            if (!ts.isNamedExports(statement.exportClause)) continue;

            for (const element of statement.exportClause.elements)
            {
                const original = (element.propertyName ?? element.name).text;
                const name = element.name.text;

                if (targetExports)
                {
                    const value = targetExports.get(original);
                    if (value) result.set(name, value);
                }
                else if (!specifier && local.has(original))
                {
                    result.set(name, { file, className: original });
                }
                else if (!specifier && imports.has(original))
                {
                    const imported = imports.get(original)!;
                    const from = this.resolveModule(pkg, file, imported.from);
                    const value = from ? this.readExports(from, pkg, seen).get(imported.imported) : undefined;
                    if (value) result.set(name, value);
                }
            }
        }

        this.exports.set(file, result);
        return result;
    }

    private analyse(pkg: Package, file: string) {
        if (!this.files.has(file)) this.files.set(file, analyseCode(file, this.typeOf(pkg)));
        return this.files.get(file)!;
    }

    /** One lazily built checker per package, rooted at its src files. */
    private typeOf(pkg: Package) {
        if (!this.checkers.has(pkg.location))
        {
            const roots = () => fs.readdirSync(pkg.src!, { recursive: true, encoding: "utf8" })
                .filter(file => /\.tsx?$/.test(file))
                .map(file => path.join(pkg.src!, file));
            this.checkers.set(pkg.location, createTypeOf(roots, pkg.location));
        }
        return this.checkers.get(pkg.location)!;
    }

    private parse(file: string) {
        return ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    }
}

/** Analyses the package at `location`; see `analysePackage` in index.ts. */
export function analyse(location: string, options: AnalysePackageOptions = {}): PackageAnalysis {
    return new Analysis(options.reuse ?? true).run(location);
}

/** Newest mtime among the package's src files and package.json. */
function newest(pkg: Package) {
    let mtime = fs.statSync(path.join(pkg.location, "package.json")).mtimeMs;
    if (!pkg.src) return mtime;

    for (const file of fs.readdirSync(pkg.src, { recursive: true, encoding: "utf8" }))
    {
        const stat = fs.statSync(path.join(pkg.src, file));
        if (stat.isFile()) mtime = Math.max(mtime, stat.mtimeMs);
    }
    return mtime;
}

/** Finds `className` among `cores` or anywhere in their extends chains. */
function findCore(cores: Core[], className: string): Core | undefined {
    for (const core of cores)
    {
        for (let current: Core | Reference | Builtin | null = core; current && "properties" in current; current = current.extends)
        {
            if (current.className === className) return current;
        }
    }
    return undefined;
}

/** An element class: its chain doesn't end in a non-element builtin (e.g. `Error`). */
function isElement(core: Core) {
    let current: Core | Reference | Builtin | null = core;
    while (current && "properties" in current) current = current.extends;
    if (!current) return false;
    if ("builtin" in current) return /Element$/.test(current.builtin);
    return true;
}
