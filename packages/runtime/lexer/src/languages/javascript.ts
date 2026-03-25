import { Lexer, type StateRules } from "lexer";

export type JSToken =
    | { type: "keyword"; value: string }
    | { type: "identifier"; value: string }
    | { type: "number"; value: string }
    | { type: "string"; value: string }
    | { type: "template"; value: string }
    | { type: "operator"; value: string }
    | { type: "punctuation"; value: string }
    | { type: "whitespace"; value: string }
    | { type: "comment"; value: string };

type CTX = { current?: "number" | "word" | "comment" };

const KEYWORDS = new Set([
    "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "export",
    "extends", "false", "finally", "for", "function", "if",
    "import", "in", "instanceof", "let", "new", "null", "of",
    "return", "super", "switch", "this", "throw", "true",
    "try", "typeof", "undefined", "var", "void", "while",
    "with", "yield", "async", "await",
]);

function emitWord(ctx: any, buffer: string) {
    if (!buffer) return;
    ctx.emit(
        KEYWORDS.has(buffer)
            ? { type: "keyword", value: buffer }
            : { type: "identifier", value: buffer }
    );
}

export const jsRules: StateRules<CTX, JSToken> = {
    EOF: [
        {
            condition: () => true,
            action: (ctx, char, buffer) => {
                if (!buffer) return;
                if (ctx.current === "number")
                {
                    ctx.emit({ type: "number", value: buffer });
                } else if (ctx.current === "comment")
                {
                    ctx.emit({ type: "comment", value: buffer });
                } else
                {
                    emitWord(ctx, buffer); // handles word/keyword
                }
            },
        },
    ],

    data: [
        { condition: '"', next: "stringDouble" },
        { condition: "'", next: "stringSingle" },
        { condition: "`", next: "template" },
        { condition: "/", next: "slash" },

        {
            condition: /[0-9]/,
            next: "number",
            action: (ctx, char) => ctx.append(char),
        },
        {
            condition: /[a-zA-Z_$]/,
            next: "word",
            action: (ctx, char) => ctx.append(char),
        },
        // operators — note: no `/` here, handled by slash state
        {
            condition: /[=<>!&|+\-*%^~?]/,
            next: "operator",
            action: (ctx, char) => ctx.append(char),
        },
        // punctuation — escaped brackets to avoid regex ambiguity
        {
            condition: /[{}()\[\].,;:]/,
            action: (ctx, char) => ctx.emit({ type: "punctuation", value: char }),
        },
        // { condition: /\s/, action: () => { } },// in data state, replace the silent whitespace rule:
        { condition: /\s/, action: (ctx, char) => ctx.emit({ type: "whitespace", value: char }) },
    ],

    word: [
        {
            condition: /[a-zA-Z0-9_$]/,
            action: (ctx, char) => {
                ctx.current = "word";
                ctx.append(char);
            },
        },
        {
            condition: () => true,
            next: "data",
            action: (ctx, char, buffer) => {
                emitWord(ctx, buffer);
                ctx.reconsume();
            },
        },
    ],

    // supports integers, floats, hex (0x...), BigInt (123n), numeric separators (1_000)
    number: [
        {
            condition: /[0-9a-fA-FxX._n]/,
            action: (ctx, char) => {
                ctx.current = "number";
                ctx.append(char);
            },
        },
        {
            condition: () => true,
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "number", value: buffer });
                ctx.reconsume();
            },
        },
    ],

    stringDouble: [
        {
            condition: '"',
            next: "data",
            action: (ctx, char, buffer) => ctx.emit({ type: "string", value: buffer }),
        },
        { condition: "\\", next: "stringDoubleEscape" },
        { condition: () => true, action: (ctx, char) => ctx.append(char) },
    ],
    stringDoubleEscape: [
        {
            condition: () => true,
            next: "stringDouble",
            action: (ctx, char) => ctx.append(char),
        },
    ],

    stringSingle: [
        {
            condition: "'",
            next: "data",
            action: (ctx, char, buffer) => ctx.emit({ type: "string", value: buffer }),
        },
        { condition: "\\", next: "stringSingleEscape" },
        { condition: () => true, action: (ctx, char) => ctx.append(char) },
    ],
    stringSingleEscape: [
        {
            condition: () => true,
            next: "stringSingle",
            action: (ctx, char) => ctx.append(char),
        },
    ],

    // template literals — ${...} interpolation not tokenized, treated as raw content
    template: [
        {
            condition: "`",
            next: "data",
            action: (ctx, char, buffer) => ctx.emit({ type: "template", value: buffer }),
        },
        { condition: "\\", next: "templateEscape" },
        { condition: () => true, action: (ctx, char) => ctx.append(char) },
    ],
    templateEscape: [
        {
            condition: () => true,
            next: "template",
            action: (ctx, char) => ctx.append(char),
        },
    ],

    slash: [
        { condition: "/", next: "commentLine" },
        { condition: "*", next: "commentBlock" },
        {
            condition: () => true,
            next: "data",
            action: (ctx) => {
                ctx.emit({ type: "operator", value: "/" });
                ctx.reconsume();
            },
        },
    ],

    commentLine: [
        {
            condition: "\n",
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.current = undefined;
                ctx.emit({ type: "comment", value: buffer });
            },
        },
        {
            condition: () => true,
            action: (ctx, char) => {
                ctx.current = "comment";
                ctx.append(char);
            },
        },
    ],

    commentBlock: [
        { condition: "*", next: "commentBlockEnd" },
        { condition: () => true, action: (ctx, char) => ctx.append(char) },
    ],
    commentBlockEnd: [
        {
            condition: "/",
            next: "data",
            action: (ctx, char, buffer) => ctx.emit({ type: "comment", value: buffer }),
        },
        {
            condition: () => true,
            next: "commentBlock",
            action: (ctx, char) => {
                ctx.append("*");
                ctx.append(char);
            },
        },
    ],

    operator: [
        {
            condition: /[=<>!&|+\-*%^~?]/,
            action: (ctx, char) => ctx.append(char),
        },
        {
            condition: () => true,
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "operator", value: buffer });
                ctx.reconsume();
            },
        },
    ],
};

export function js(value: string) {
    return new Lexer<CTX, JSToken>(jsRules, "data", { current: undefined }).run(value);
}
