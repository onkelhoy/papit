/**
 * @fileoverview Markdown tokenizer: turns markdown text into a tree of blocks with inline children.
 *
 * @details
 * - Blocks: ATX and setext headings, paragraphs, fenced and indented code, nested quotes,
 *   ordered/unordered/task lists (nested by indentation), GFM tables with alignment, rules.
 * - Inline: `code`, **strong**, *em*, ~~del~~, [links](href "title"), ![images](src),
 *   <autolinks>, bare http(s) URLs, hard breaks and backslash escapes.
 * - Raw HTML is not recognised: it stays text, so a renderer that builds DOM nodes stays safe.
 * - Hrefs are returned as written. Filtering unsafe schemes is the renderer's job.
 */

export type MarkdownInline =
    | { type: "text"; text: string }
    | { type: "code"; text: string }
    | { type: "break" }
    | { type: "strong" | "em" | "del"; children: MarkdownInline[] }
    | { type: "link"; href: string; title?: string; children: MarkdownInline[] }
    | { type: "image"; src: string; alt: string; title?: string };

export type MarkdownAlign = "left" | "center" | "right" | null;

export type MarkdownListItem = { checked?: boolean; children: MarkdownBlock[] };

export type MarkdownBlock =
    | { type: "heading"; level: number; children: MarkdownInline[] }
    | { type: "paragraph"; children: MarkdownInline[] }
    | { type: "code"; lang: string; text: string }
    | { type: "quote"; children: MarkdownBlock[] }
    | { type: "list"; ordered: boolean; start: number; loose: boolean; items: MarkdownListItem[] }
    | { type: "table"; align: MarkdownAlign[]; head: MarkdownInline[][]; rows: MarkdownInline[][][] }
    | { type: "rule" };

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const SETEXT = /^ {0,3}(=+|-+)\s*$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}>\s?/;
const ITEM = /^( {0,3})([-*+]|(\d{1,9})[.)])( +|$)/;
const DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const INDENTED = /^ {4}/;

// ---------------------------------------------------------------- blocks

/** Tokenizes markdown into blocks. */
export function markdown(text: string): MarkdownBlock[] {
    return blocks(text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n"));
}

function blocks(lines: string[]): MarkdownBlock[] {
    const out: MarkdownBlock[] = [];
    let paragraph: string[] = [];

    const flush = () => {
        if (paragraph.length) out.push({ type: "paragraph", children: markdownInline(paragraph.join("\n").trim()) });
        paragraph = [];
    };

    for (let i = 0; i < lines.length; i++)
    {
        const line = lines[i];

        if (!line.trim())
        {
            flush();
            continue;
        }

        // indented code can't interrupt a paragraph
        if (!paragraph.length && INDENTED.test(line))
        {
            const code: string[] = [];
            while (i < lines.length && (INDENTED.test(lines[i]) || !lines[i].trim())) code.push(lines[i++].slice(4));
            i--;
            while (code.length && !code[code.length - 1].trim()) code.pop();
            out.push({ type: "code", lang: "", text: code.join("\n") });
            continue;
        }

        // fenced code: up to a closing fence at least as long, or to the end
        const fence = line.match(FENCE);
        if (fence)
        {
            flush();
            const close = new RegExp(`^ {0,3}\\${fence[1][0]}{${fence[1].length},}\\s*$`);
            const code: string[] = [];
            i++;
            while (i < lines.length && !close.test(lines[i])) code.push(lines[i++]);
            out.push({ type: "code", lang: fence[2], text: code.join("\n") });
            continue;
        }

        const heading = line.match(HEADING);
        if (heading)
        {
            flush();
            out.push({ type: "heading", level: heading[1].length, children: markdownInline(heading[2] ?? "") });
            continue;
        }

        // a ===/--- line under a paragraph makes it a heading
        const setext = paragraph.length ? line.match(SETEXT) : null;
        if (setext)
        {
            out.push({ type: "heading", level: setext[1][0] === "=" ? 1 : 2, children: markdownInline(paragraph.join("\n").trim()) });
            paragraph = [];
            continue;
        }

        if (RULE.test(line))
        {
            flush();
            out.push({ type: "rule" });
            continue;
        }

        if (QUOTE.test(line))
        {
            flush();
            const quoted: string[] = [];
            while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, ""));
            i--;
            out.push({ type: "quote", children: blocks(quoted) });
            continue;
        }

        // a table is a row with pipes followed by a divider row
        if (line.includes("|") && i + 1 < lines.length && lines[i + 1].includes("-") && DIVIDER.test(lines[i + 1]))
        {
            flush();
            const head = cells(line);
            const align = cells(lines[i + 1]).map(cell => {
                const left = cell.startsWith(":");
                const right = cell.endsWith(":");
                return left && right ? "center" : right ? "right" : left ? "left" : null;
            });
            const rows: MarkdownInline[][][] = [];
            i += 2;
            while (i < lines.length && lines[i].trim() && lines[i].includes("|"))
            {
                const row = cells(lines[i++]);
                rows.push(head.map((_, index) => markdownInline(row[index] ?? "")));
            }
            i--;
            out.push({ type: "table", align: head.map((_, index) => align[index] ?? null), head: head.map(cell => markdownInline(cell)), rows });
            continue;
        }

        if (ITEM.test(line))
        {
            flush();
            i = list(lines, i, out) - 1;
            continue;
        }

        paragraph.push(line);
    }
    flush();

    return out;
}

/** Reads a list starting at `start` into `out`, returns the index of the first line after it. */
function list(lines: string[], start: number, out: MarkdownBlock[]): number {
    const first = lines[start].match(ITEM)!;
    const ordered = first[3] !== undefined;
    const block: MarkdownBlock = { type: "list", ordered, start: ordered ? Number(first[3]) : 1, loose: false, items: [] };

    let i = start;
    while (i < lines.length)
    {
        const item = lines[i].match(ITEM);
        if (!item || (item[3] !== undefined) !== ordered) break;

        const marker = item[1].length;
        // content starts after the marker and its spaces; an empty item continues one past the marker
        const indent = item[4] ? item[0].length : marker + item[2].length + 1;
        const content = [lines[i].slice(item[0].length)];
        i++;

        while (i < lines.length)
        {
            const next = lines[i];
            if (!next.trim())
            {
                let j = i;
                while (j < lines.length && !lines[j].trim()) j++;
                if (j >= lines.length) break;

                if (indentOf(lines[j]) > marker)
                {
                    // a blank line inside an item makes the list loose
                    block.loose = true;
                    while (i < j) { content.push(""); i++; }
                    continue;
                }

                const sibling = lines[j].match(ITEM);
                if (sibling && (sibling[3] !== undefined) === ordered && sibling[1].length === marker)
                {
                    block.loose = true;
                    i = j;
                }
                break;
            }

            const depth = indentOf(next);
            if (depth > marker)
            {
                content.push(next.slice(Math.min(indent, depth)));
                i++;
                continue;
            }

            // lazy continuation of the item's paragraph
            if (!startsBlock(next))
            {
                content.push(next.trim());
                i++;
                continue;
            }
            break;
        }

        let checked: boolean | undefined;
        const task = content[0].match(/^\[([ xX])\]\s+/);
        if (task)
        {
            checked = task[1] !== " ";
            content[0] = content[0].slice(task[0].length);
        }

        block.items.push({ checked, children: blocks(content) });
    }

    out.push(block);
    return i;
}

function startsBlock(line: string) {
    return ITEM.test(line) || FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line);
}

function indentOf(line: string) {
    return line.length - line.trimStart().length;
}

// table cells: outer pipes are optional, \| is a literal pipe
function cells(line: string) {
    return line.trim()
        .replace(/^\|/, "")
        .replace(/(?<!\\)\|$/, "")
        .split(/(?<!\\)\|/)
        .map(cell => cell.trim().replace(/\\\|/g, "|"));
}

// ---------------------------------------------------------------- inline

// longest first, so ** wins over *
const MARKS: { mark: string; type: "strong" | "em" | "del" }[] = [
    { mark: "**", type: "strong" },
    { mark: "__", type: "strong" },
    { mark: "~~", type: "del" },
    { mark: "*", type: "em" },
    { mark: "_", type: "em" },
];

const ESCAPABLE = /[!-/:-@[-`{-~]/;
const WORD = /[\p{L}\p{N}]/u;
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
// trailing punctuation that usually ends the sentence, not the URL
const TRAILING = /[.,;:!?)\]}'"]+$/;

/** Tokenizes the inline content of one paragraph, heading, list item or table cell. */
export function markdownInline(text: string): MarkdownInline[] {
    const out: MarkdownInline[] = [];
    let plain = "";
    const push = (node: MarkdownInline) => {
        if (plain) out.push(...autolink(plain));
        plain = "";
        out.push(node);
    };

    let i = 0;
    while (i < text.length)
    {
        const char = text[i];
        const rest = text.slice(i);

        if (char === "\\" && i + 1 < text.length)
        {
            if (text[i + 1] === "\n")
            {
                push({ type: "break" });
                i += 2;
                continue;
            }
            if (ESCAPABLE.test(text[i + 1]))
            {
                plain += text[i + 1];
                i += 2;
                continue;
            }
        }

        // two spaces before a newline are a hard break, otherwise the newline is soft
        if (char === "\n")
        {
            const hard = / {2,}$/.test(plain);
            plain = plain.replace(/ +$/, "");
            if (hard) push({ type: "break" });
            else plain += "\n";
            i++;
            while (text[i] === " ") i++;
            continue;
        }

        // `code`: closed by a run of the same length, nothing inside is parsed
        if (char === "`")
        {
            const run = rest.match(/^`+/)![0];
            const end = codeEnd(text, i + run.length, run);
            if (end > -1)
            {
                let code = text.slice(i + run.length, end).replace(/\n/g, " ");
                if (/^ .* $/.test(code) && code.trim()) code = code.slice(1, -1);
                push({ type: "code", text: code });
                i = end + run.length;
                continue;
            }
            plain += run;
            i += run.length;
            continue;
        }

        if (char === "!" && text[i + 1] === "[")
        {
            const found = link(text, i + 1);
            if (found)
            {
                push({ type: "image", src: found.href, alt: found.label, ...(found.title !== undefined && { title: found.title }) });
                i = found.end;
                continue;
            }
        }

        if (char === "[")
        {
            const found = link(text, i);
            if (found)
            {
                push({ type: "link", href: found.href, ...(found.title !== undefined && { title: found.title }), children: markdownInline(found.label).map(unlink) });
                i = found.end;
                continue;
            }
        }

        if (char === "<")
        {
            const auto = rest.match(/^<((?:https?|mailto):[^\s<>]+)>/i);
            if (auto)
            {
                push({ type: "link", href: auto[1], children: [{ type: "text", text: auto[1].replace(/^mailto:/i, "") }] });
                i += auto[0].length;
                continue;
            }
        }

        const paired = MARKS.find(({ mark }) => rest.startsWith(mark));
        if (paired)
        {
            const close = closing(text, i, paired.mark);
            if (close > 0)
            {
                push({ type: paired.type, children: markdownInline(text.slice(i + paired.mark.length, close)) });
                i = close + paired.mark.length;
                continue;
            }
            // an unmatched run stays text as a whole, so "**" doesn't retry as two "*"
            plain += paired.mark;
            i += paired.mark.length;
            continue;
        }

        plain += char;
        i++;
    }
    if (plain) out.push(...autolink(plain));
    return out;
}

function codeEnd(text: string, from: number, run: string) {
    let at = text.indexOf(run, from);
    while (at > -1)
    {
        if (text[at + run.length] !== "`" && text[at - 1] !== "`") return at;
        at = text.indexOf(run, at + 1);
    }
    return -1;
}

// where `mark` opened at `start` closes, or -1. The text inside must not start or end with a space,
// so "2 * 3 * 4" stays plain; a single * must not be part of a ** pair; _ doesn't work inside words
function closing(text: string, start: number, mark: string): number {
    const from = start + mark.length;
    if (from >= text.length || /\s/.test(text[from])) return -1;
    if (mark[0] === "_" && WORD.test(text[start - 1] ?? "")) return -1;

    for (let at = from + 1; at < text.length; at++)
    {
        if (text[at] === "\\")
        {
            at++;
            continue;
        }
        // skip code spans, a mark inside one doesn't close
        if (text[at] === "`")
        {
            const run = text.slice(at).match(/^`+/)![0];
            const end = codeEnd(text, at + run.length, run);
            if (end > -1) at = end + run.length - 1;
            continue;
        }
        if (!text.startsWith(mark, at)) continue;
        if (/\s/.test(text[at - 1])) continue;
        if (mark.length === 1 && (text[at + 1] === mark || text[at - 1] === mark)) continue;
        if (mark[0] === "_" && WORD.test(text[at + mark.length] ?? "")) continue;
        return at;
    }
    return -1;
}

// [label](href "title") with `at` on the "[": brackets in the label may nest
function link(text: string, at: number) {
    let depth = 0;
    let i = at;
    for (; i < text.length; i++)
    {
        if (text[i] === "\\") i++;
        else if (text[i] === "[") depth++;
        else if (text[i] === "]" && --depth === 0) break;
    }
    if (i >= text.length || text[i + 1] !== "(") return null;

    const target = text.slice(i + 2).match(/^\s*(<[^>\n]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)(?:\s+("[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/);
    if (!target) return null;

    return {
        label: text.slice(at + 1, i),
        href: target[1].replace(/^<|>$/g, ""),
        title: target[2]?.slice(1, -1),
        end: i + 2 + target[0].length,
    };
}

// a link label is text only: a link inside it becomes its text
function unlink(node: MarkdownInline): MarkdownInline {
    if (node.type === "link") return { type: "text", text: textOf(node.children) };
    if (node.type === "strong" || node.type === "em" || node.type === "del") return { ...node, children: node.children.map(unlink) };
    return node;
}

function textOf(nodes: MarkdownInline[]): string {
    return nodes.map(node => {
        if (node.type === "text" || node.type === "code") return node.text;
        if (node.type === "image") return node.alt;
        if (node.type === "break") return "\n";
        return textOf(node.children);
    }).join("");
}

// splits plain text into text and bare-link nodes; trailing punctuation stays outside the link
function autolink(text: string): MarkdownInline[] {
    const out: MarkdownInline[] = [];
    let last = 0;

    for (const match of text.matchAll(URL_PATTERN))
    {
        const start = match.index ?? 0;
        const url = match[0].replace(TRAILING, "");
        if (start > last) out.push({ type: "text", text: text.slice(last, start) });
        out.push({ type: "link", href: url, children: [{ type: "text", text: url }] });
        last = start + url.length;
    }

    if (last < text.length) out.push({ type: "text", text: text.slice(last) });
    return out;
}
