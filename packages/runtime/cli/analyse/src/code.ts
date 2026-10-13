import path from "node:path";
import fs from "node:fs";

import ts from "typescript";

import { createTypeOf, type TypeOf } from "./checker";
import { readStylesheet } from "./stylesheet";
import { readTemplate } from "./template";
import type { Builtin, Core, CssVariable, Event, Method, Part, Property, Reference, Slot } from "./types";

const HIDDEN_METHODS = new Set([
    "connectedCallback",
    "disconnectedCallback",
    "attributeChangedCallback",
    "adoptedCallback",
    "formAssociatedCallback",
    "formDisabledCallback",
    "formResetCallback",
    "formStateRestoreCallback",
    "firstRender",
    "render",
]);

/** Fields that are internal wiring, not public API. */
const HIDDEN_FIELD_DECORATORS = ["query", "translate"];

/**
 * Analyses every class with an `extends` clause in `file`, plus the stylesheets it imports.
 * `typeOf` resolves types the source doesn't spell out; it defaults to a checker for this file alone.
 */
export function analyseCode(file: string, typeOf: TypeOf = createTypeOf(() => [file])): Core[] {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    const imports = readImports(source);
    const tags = readTagNames(source);
    const local = new Set<string>();
    source.statements.forEach(s => ts.isClassDeclaration(s) && s.name && local.add(s.name.text));

    const cores: Core[] = [];
    for (const statement of source.statements)
    {
        if (!ts.isClassDeclaration(statement) || !statement.name) continue;
        const heritage = statement.heritageClauses?.find(h => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0];
        if (!heritage) continue;

        cores.push(readClass(statement, heritage, file, imports, local, tags.get(statement.name.text), typeOf));
    }

    return cores;
}

function readClass(
    node: ts.ClassDeclaration,
    heritage: ts.ExpressionWithTypeArguments,
    file: string,
    imports: Imports,
    local: Set<string>,
    tagName: string | undefined,
    typeOf: TypeOf,
): Core {
    const docs = readDocs(node);

    const core: Core = {
        tagName,
        className: node.name!.text,
        description: docs.description,
        source: { file },
        properties: readProperties(node, docs.properties, typeOf),
        methods: readMethods(node),
        events: [],
        states: [],
        html: { slots: [], parts: [] },
        css: { variables: [] },
        extends: readExtends(heritage, file, imports, local),
    };
    if (core.tagName === undefined) delete core.tagName;
    if (core.description === undefined) delete core.description;

    // walks the whole class, decorator arguments included
    const addTemplate = (text: string) => {
        const { slots, parts } = readTemplate(text);
        slots.forEach(slot => !core.html.slots.some(s => s.name === slot.name) && core.html.slots.push(slot));
        parts.forEach(part => !core.html.parts.some(p => p.name === part.name) && core.html.parts.push(part));
    };

    const visit = (child: ts.Node) => {
        if (ts.isCallExpression(child)) readCall(child, core, typeOf);
        else if (ts.isTaggedTemplateExpression(child) && child.tag.getText() === "html")
        {
            addTemplate(templateText(child.template));
        }
        else if (ts.isReturnStatement(child) && child.expression && ts.isStringLiteralLike(child.expression) && isInRender(child))
        {
            addTemplate(child.expression.text);
        }
        else if (ts.isIdentifier(child) && imports.get(child.text)?.from.endsWith(".css"))
        {
            const stylesheet = path.resolve(path.dirname(file), imports.get(child.text)!.from);
            if (fs.existsSync(stylesheet)) mergeVariables(core.css.variables, readStylesheet(fs.readFileSync(stylesheet, "utf8")));
        }
        ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);

    mergeTags(core, docs);
    return core;
}

// class members

function readProperties(node: ts.ClassDeclaration, documented: Map<string, string>, typeOf: TypeOf): Property[] {
    const properties: Property[] = [];

    for (const member of node.members)
    {
        if (!ts.isPropertyDeclaration(member) || !isPublic(member) || isStatic(member)) continue;
        if (!ts.isIdentifier(member.name)) continue;
        if (HIDDEN_FIELD_DECORATORS.some(name => decorator(member, name))) continue;

        const name = member.name.text;
        const property: Property = { name, type: member.type?.getText() ?? inferType(member.initializer) };
        if (property.type === "unknown") property.type = typeOf(member.name) ?? "unknown";
        else if (member.type && referencesName(member.type))
        {
            const resolved = typeOf(member.name, true);
            if (resolved && resolved !== property.type) property.resolvedType = resolved;
        }

        const options = decorator(member, "property");
        if (options)
        {
            const settings = options.arguments[0];
            const read = (key: string) => settings && ts.isObjectLiteralExpression(settings)
                ? settings.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText() === key)?.initializer
                : undefined;

            // mirrors the engine: attribute defaults to true, which means the key as written
            const attribute = read("attribute");
            if (attribute && ts.isStringLiteralLike(attribute)) property.attribute = attribute.text;
            else if (attribute?.kind === ts.SyntaxKind.FalseKeyword) property.attribute = false;
            else property.attribute = name;

            // the engine reflects whenever there is an attribute, unless reflect is false
            property.reflect = property.attribute !== false && read("reflect")?.kind !== ts.SyntaxKind.FalseKeyword;

            const converter = read("type");
            if (converter) property.converter = converter.getText();
            if (read("readonly")?.kind === ts.SyntaxKind.TrueKeyword) property.readonly = true;
        }

        if (member.initializer) property.default = member.initializer.getText();
        if (hasModifier(member, ts.SyntaxKind.ReadonlyKeyword)) property.readonly = true;

        const description = readDocs(member).description ?? documented.get(name);
        if (description) property.description = description;

        properties.push(property);
    }

    return properties;
}

function readMethods(node: ts.ClassDeclaration): Method[] {
    const methods: Method[] = [];

    for (const member of node.members)
    {
        if (!ts.isMethodDeclaration(member) || !isPublic(member) || isStatic(member)) continue;
        if (!ts.isIdentifier(member.name) || HIDDEN_METHODS.has(member.name.text)) continue;
        if (decorator(member, "bind") !== undefined) continue;

        // with overloads, the signatures are the API and the implementation is not
        const overloaded = node.members.some(m => m !== member && ts.isMethodDeclaration(m) && !m.body && m.name.getText() === member.name.getText());
        if (member.body && overloaded) continue;

        const generics = member.typeParameters ? `<${member.typeParameters.map(p => p.getText()).join(", ")}>` : "";
        const parameters = member.parameters.map(p => p.getText()).join(", ");
        const method: Method = {
            name: member.name.text,
            signature: `${generics}(${parameters})${member.type ? `: ${member.type.getText()}` : ""}`,
        };
        const description = readDocs(member).description;
        if (description) method.description = description;

        methods.push(method);
    }

    return methods;
}

function readExtends(heritage: ts.ExpressionWithTypeArguments, file: string, imports: Imports, local: Set<string>): Reference | Builtin {
    const className = heritage.expression.getText();
    const imported = imports.get(className);
    if (imported) return { className: imported.imported, import: imported.from };
    if (local.has(className)) return { className, import: file };
    return { builtin: className };
}

/** `dispatchEvent(new Event | CustomEvent("name"))` and `….states.add("name")`. */
function readCall(call: ts.CallExpression, core: Core, typeOf: TypeOf) {
    if (!ts.isPropertyAccessExpression(call.expression)) return;
    const method = call.expression.name.text;
    const [first] = call.arguments;

    if (method === "dispatchEvent" && first && ts.isNewExpression(first))
    {
        const kind = first.expression.getText();
        const name = first.arguments?.[0];
        if ((kind !== "Event" && kind !== "CustomEvent") || !name || !ts.isStringLiteralLike(name)) return;
        if (core.events.some(e => e.name === name.text)) return;

        const event: Event = { name: name.text, kind };
        const generic = first.typeArguments?.[0];
        if (generic) event.detail = generic.getText();
        else if (kind === "CustomEvent")
        {
            const init = first.arguments?.[1];
            const detail = init && ts.isObjectLiteralExpression(init)
                ? init.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText() === "detail")
                : undefined;
            const type = detail && typeOf(detail.initializer);
            if (type) event.detail = type;
        }
        core.events.push(event);
    }
    else if (method === "add" && call.expression.expression.getText().endsWith("states") && first && ts.isStringLiteralLike(first))
    {
        if (!core.states.includes(first.text)) core.states.push(first.text);
    }
}

// JSDoc

type Docs = {
    description?: string;
    properties: Map<string, string>;
    tags: { tag: string; text: string }[];
};

function readDocs(node: ts.Node): Docs {
    const docs: Docs = { properties: new Map(), tags: [] };

    for (const doc of ts.getJSDocCommentsAndTags(node))
    {
        if (!ts.isJSDoc(doc)) continue;
        const { description, tags } = parseDoc(doc.getText());
        if (description) docs.description = description;

        for (const tag of tags)
        {
            // on a class, `@property {type} name description` documents a field
            const property = tag.tag === "property" && tag.text.match(/^(?:\{[^}]*\}\s*)?([\w$]+)\s*(?:-\s*)?([\s\S]*)$/);
            if (property) docs.properties.set(property[1]!, property[2]!.trim());
            else docs.tags.push(tag);
        }
    }

    return docs;
}

/**
 * Splits a raw `/** ... *\/` comment into its description and tags. Only an `@` that starts a line
 * starts a tag, so a description may mention `@property` mid-text (TS's own parser would cut it there).
 */
function parseDoc(comment: string) {
    const lines = comment
        .replace(/^\/\*\*/, "")
        .replace(/\*\/$/, "")
        .split(/\r?\n/)
        .map(line => line.replace(/^\s*\*(?!\/) ?/, "").trimEnd());

    const description: string[] = [];
    const tags: { tag: string; lines: string[] }[] = [];
    for (const line of lines)
    {
        const tag = line.match(/^\s*@([\w-]+)\s?(.*)$/);
        if (tag) tags.push({ tag: tag[1]!, lines: [tag[2]!] });
        else (tags.at(-1)?.lines ?? description).push(line);
    }

    return {
        description: description.join("\n").trim() || undefined,
        tags: tags.map(({ tag, lines }) => ({ tag, text: lines.map(line => line.trim()).join("\n").trim() })),
    };
}

/** Folds `@fires`, `@slot`, `@csspart` and `@cssprop` tags into what the code already showed. */
function mergeTags(core: Core, docs: Docs) {
    for (const { tag, text } of docs.tags)
    {
        // `{type} [name=default] - description`, type and brackets optional
        const { type, rest } = splitType(text);
        const match = rest.match(/^(?:\[([^\]=]+)(?:=([^\]]*))?\]|(\S+))\s*(?:-\s*)?([\s\S]*)$/);
        if (!match) continue;
        const name = (match[1] ?? match[3])!.trim();
        const fallback = match[2]?.trim() || undefined;
        const description = match[4]!.trim() || undefined;

        if (tag === "fires")
        {
            const kind = type?.startsWith("CustomEvent") ? "CustomEvent" : "Event";
            const event = core.events.find(e => e.name === name) ?? push(core.events, { name, kind } as Event);
            if (description) event.description = description;
            const detail = type?.match(/^CustomEvent<([\s\S]*)>$/)?.[1]?.trim();
            if (detail) event.detail ??= detail;
        }
        else if (tag === "slot")
        {
            const slotname = name === "-" ? null : name;
            const slot = core.html.slots.find(s => s.name === slotname) ?? push(core.html.slots, { name: slotname } as Slot);
            if (description) slot.description = description;
        }
        else if (tag === "csspart")
        {
            const part = core.html.parts.find(p => p.name === name) ?? push(core.html.parts, { name } as Part);
            if (description) part.description = description;
        }
        else if (tag === "cssprop" || tag === "cssproperty")
        {
            const variable = core.css.variables.find(v => v.name === name) ?? push(core.css.variables, { name, declared: false, used: false } as CssVariable);
            if (description) variable.description = description;
            if (fallback) variable.default ??= fallback;
        }
    }
}

// helpers

/** Splits a leading `{type}` (braces balanced) off a JSDoc tag's text. */
function splitType(text: string): { type?: string; rest: string } {
    if (!text.startsWith("{")) return { rest: text };

    let depth = 0;
    for (let i = 0; i < text.length; i++)
    {
        if (text[i] === "{") depth++;
        else if (text[i] === "}" && --depth === 0) return { type: text.slice(1, i).trim(), rest: text.slice(i + 1).trim() };
    }
    return { rest: text };
}

/** Local name → module specifier and the name it was imported as (`default` imports keep the local name). */
export type Imports = Map<string, { from: string; imported: string }>;

export function readImports(source: ts.SourceFile): Imports {
    const imports: Imports = new Map();

    for (const statement of source.statements)
    {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const from = statement.moduleSpecifier.text;
        const clause = statement.importClause;
        if (!clause) continue;

        if (clause.name) imports.set(clause.name.text, { from, imported: clause.name.text });
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
        {
            bindings.elements.forEach(e => imports.set(e.name.text, { from, imported: (e.propertyName ?? e.name).text }));
        }
    }

    return imports;
}

/** className → tag, from `HTMLElementTagNameMap` and `customElements.define` in the file. */
export function readTagNames(source: ts.SourceFile) {
    const tags = new Map<string, string>();

    const visit = (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === "HTMLElementTagNameMap")
        {
            for (const member of node.members)
            {
                if (ts.isPropertySignature(member) && member.type && ts.isStringLiteralLike(member.name))
                {
                    tags.set(member.type.getText(), member.name.text);
                }
            }
        }
        else if (ts.isCallExpression(node) && node.expression.getText().endsWith("customElements.define"))
        {
            const [tag, ctor] = node.arguments;
            if (tag && ctor && ts.isStringLiteralLike(tag) && ts.isIdentifier(ctor)) tags.set(ctor.text, tag.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);

    return tags;
}

/** Inside the class's own `render()`, not a nested function. */
function isInRender(node: ts.Node) {
    for (let parent = node.parent; parent; parent = parent.parent)
    {
        if (ts.isMethodDeclaration(parent)) return parent.name.getText() === "render";
        if (ts.isFunctionLike(parent)) return false;
    }
    return false;
}

function templateText(template: ts.TemplateLiteral) {
    if (ts.isNoSubstitutionTemplateLiteral(template)) return template.text;
    return template.head.text + template.templateSpans.map((span, i) => "${" + i + "}" + span.literal.text).join("");
}

function decorator(node: ts.HasDecorators, name: string) {
    for (const d of ts.getDecorators(node) ?? [])
    {
        if (ts.isIdentifier(d.expression) && d.expression.text === name) return { arguments: [] as ts.Expression[] };
        if (ts.isCallExpression(d.expression) && d.expression.expression.getText() === name) return { arguments: [...d.expression.arguments] };
    }
    return undefined;
}

/** Whether a written type names something the source doesn't spell out: an alias, an indexed access, `typeof`, `keyof`. */
function referencesName(type: ts.TypeNode): boolean {
    if (ts.isTypeReferenceNode(type) || ts.isIndexedAccessTypeNode(type) || ts.isTypeQueryNode(type)) return true;
    if (ts.isTypeOperatorNode(type) && type.operator === ts.SyntaxKind.KeyOfKeyword) return true;
    return ts.forEachChild(type, child => ts.isTypeNode(child) && referencesName(child)) ?? false;
}

function inferType(initializer?: ts.Expression) {
    if (!initializer) return "unknown";
    if (ts.isStringLiteralLike(initializer)) return "string";
    if (ts.isNumericLiteral(initializer)) return "number";
    if (initializer.kind === ts.SyntaxKind.TrueKeyword || initializer.kind === ts.SyntaxKind.FalseKeyword) return "boolean";
    return "unknown";
}

function isPublic(member: ts.ClassElement) {
    if (member.name && ts.isPrivateIdentifier(member.name)) return false;
    return !hasModifier(member, ts.SyntaxKind.PrivateKeyword) && !hasModifier(member, ts.SyntaxKind.ProtectedKeyword);
}

function isStatic(member: ts.ClassElement) {
    return hasModifier(member, ts.SyntaxKind.StaticKeyword);
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind) {
    return ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some(m => m.kind === kind) ?? false);
}

function mergeVariables(into: CssVariable[], found: CssVariable[]) {
    for (const variable of found)
    {
        const existing = into.find(v => v.name === variable.name);
        if (!existing) into.push(variable);
        else
        {
            existing.declared ||= variable.declared;
            existing.used ||= variable.used;
            existing.default ??= variable.default;
        }
    }
}

function push<T>(list: T[], item: T) {
    list.push(item);
    return item;
}
