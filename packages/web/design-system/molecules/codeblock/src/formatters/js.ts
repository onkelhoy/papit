import { js as lexer } from "@papit/lexer";

function dedent(code: string): string {
    const lines = code.split("\n");

    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

    const minIndent = Math.min(
        ...lines
            .filter(l => l.trim().length > 0 && /^\s/.test(l)) // ← only lines WITH leading whitespace
            .map(l => (l.match(/^(\s*)/) ?? ["", ""])[1].length)
    );

    // if no indented lines found, nothing to strip
    if (!isFinite(minIndent)) return lines.join("\n");

    // return lines.map(l => l.slice(minIndent)).join("\n");
    return lines.map(l => /^\s/.test(l) ? l.slice(minIndent) : l).join("\n");
}

export function js(content: string, indent: number) {
    const tokens = lexer(dedent(content));
    const value = tokens.map(token => {
        let value = token.value;

        switch (token.type)
        {
            case "whitespace":
                if (value === " ") return "&nbsp;";
                if (value === "\n") return "</br>";
                break;
            case "keyword":
                return `<span class="keyword ${["async", "await", "while"].includes(value) ? "secondary" : ""}">${value}</span>`;
            case "operator":
            case "identifier":
            case "punctuation":
                return `<span class="${token.type}">${value}</span>`;
            case "string":
                return `<span class="value string">"${value}"</span>`;
            case "number":
                return `<span class="value number">${value}</span>`;
            case "comment":
                return `<span class="comment">//${value}</span>`;
        }
    })

    return `<div class="js" style="padding-left: ${indent}rem">${value.join("")}</div>`;
}