import { css } from "@papit/lexer";

import type { CssVariable } from "./types";

/**
 * Custom properties declared (`--x: …`) or read (`var(--x, fallback)`) in a stylesheet.
 * `default` is the declared value, else the first `var()` fallback.
 */
export function readStylesheet(source: string): CssVariable[] {
    const variables = new Map<string, CssVariable>();
    const get = (name: string) => {
        let variable = variables.get(name);
        if (!variable)
        {
            variable = { name, declared: false, used: false };
            variables.set(name, variable);
        }
        return variable;
    };

    let property: string | null = null;
    for (const token of css(source))
    {
        if (token.type === "property")
        {
            property = token.value;
            continue;
        }
        if (token.type !== "value") continue;

        if (property?.startsWith("--"))
        {
            const variable = get(property);
            variable.declared = true;
            variable.default = token.value;
        }
        property = null;

        for (const usage of readVar(token.value))
        {
            const variable = get(usage.name);
            variable.used = true;
            if (variable.default === undefined && usage.fallback !== undefined) variable.default = usage.fallback;
        }
    }

    return [...variables.values()];
}

/** Every `var(--name, fallback)` in a value, nested ones in fallbacks included. */
function readVar(value: string) {
    const found: { name: string; fallback?: string }[] = [];
    let index = value.indexOf("var(");

    while (index !== -1)
    {
        const start = index + 4;
        if (index > 0 && /[\w-]/.test(value[index - 1]!))
        {
            index = value.indexOf("var(", start);
            continue;
        }

        let depth = 1;
        let end = start;
        for (; end < value.length && depth > 0; end++)
        {
            if (value[end] === "(") depth++;
            else if (value[end] === ")") depth--;
        }

        const inner = value.slice(start, depth === 0 ? end - 1 : end);
        const comma = inner.indexOf(",");
        const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
        if (name.startsWith("--"))
        {
            const fallback = comma === -1 ? undefined : inner.slice(comma + 1).trim();
            found.push({ name, fallback: fallback || undefined });
        }

        index = value.indexOf("var(", start);
    }

    return found;
}
