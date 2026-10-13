import { html } from "@papit/lexer";

import type { Part, Slot } from "./types";

/** Slots and parts in an html`` template. `${…}` placeholders are skipped. */
export function readTemplate(source: string) {
    const slots: Slot[] = [];
    const parts: Part[] = [];

    for (const token of html(source))
    {
        if (token.type !== "startTag") continue;

        if (token.name === "slot")
        {
            const name = token.attributes.name;
            const slotname = typeof name === "string" && name.length > 0 ? name : null;
            if (!isDynamic(slotname) && !slots.some(s => s.name === slotname)) slots.push({ name: slotname });
        }

        const part = token.attributes.part;
        if (typeof part !== "string") continue;
        for (const name of part.split(/\s+/))
        {
            if (name && !isDynamic(name) && !parts.some(p => p.name === name)) parts.push({ name });
        }
    }

    return { slots, parts };
}

function isDynamic(value: string | null) {
    return value !== null && value.includes("${");
}
