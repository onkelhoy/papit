import { Lexer, type StateRules } from "lexer";

export type JSToken =
    | { type: "keyword"; value: string }
    | { type: "identifier"; value: string }
    | { type: "number"; value: string }
    | { type: "string"; value: string }
    | { type: "operator"; value: string }
    | { type: "punctuation"; value: string }
    | { type: "comment"; value: string };

type CTX = {};

const KEYWORDS = new Set([
    "const", "let", "var", "function", "return",
    "if", "else", "for", "while", "switch",
    "async", "await",
    "case", "break", "continue", "true", "false", "null", "undefined"
]);

function emitWord(ctx: any, buffer: string) {
    if (!buffer) return;

    if (KEYWORDS.has(buffer))
    {
        ctx.emit({ type: "keyword", value: buffer });
    } else
    {
        ctx.emit({ type: "identifier", value: buffer });
    }
}

export const jsRules: StateRules<CTX, JSToken> = {
    EOF: [
        {
            condition: () => true,
            action: (ctx, char, buffer) => {
                emitWord(ctx, buffer);
            },
        },
    ],

    data: [
        // strings
        { condition: '"', next: "stringDouble" },
        { condition: "'", next: "stringSingle" },

        // comments
        { condition: "/", next: "slash" },

        // numbers (must come before identifiers)
        {
            condition: /[0-9]/,
            next: "number",
            action: (ctx, char) => ctx.append(char),
        },

        // identifiers / keywords
        {
            condition: /[a-zA-Z_$]/,
            next: "word",
            action: (ctx, char) => ctx.append(char),
        },

        // operators (single + multi char handled in operator state)
        {
            condition: /[=<>!&|+\-*\/%]/,
            next: "operator",
            action: (ctx, char) => ctx.append(char),
        },

        // punctuation
        {
            condition: /[{}()[\].,;:]/,
            action: (ctx, char) => ctx.emit({ type: "punctuation", value: char }),
        },

        // whitespace ignored
        { condition: /\s/, action: () => { } },
    ],

    // identifiers / keywords
    word: [
        {
            condition: /[a-zA-Z0-9_$]/,
            action: (ctx, char) => ctx.append(char),
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

    // numbers
    number: [
        {
            condition: /[0-9.]/,
            action: (ctx, char) => ctx.append(char),
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

    // strings
    stringDouble: [
        {
            condition: '"',
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "string", value: buffer });
            },
        },
        {
            condition: "\\",
            next: "stringDoubleEscape",
        },
        {
            condition: () => true,
            action: (ctx, char) => ctx.append(char),
        },
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
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "string", value: buffer });
            },
        },
        {
            condition: "\\",
            next: "stringSingleEscape",
        },
        {
            condition: () => true,
            action: (ctx, char) => ctx.append(char),
        },
    ],

    stringSingleEscape: [
        {
            condition: () => true,
            next: "stringSingle",
            action: (ctx, char) => ctx.append(char),
        },
    ],

    // slash handling (comments vs operator)
    slash: [
        {
            condition: "/",
            next: "commentLine",
        },
        {
            condition: "*",
            next: "commentBlock",
        },
        {
            condition: () => true,
            next: "data",
            action: (ctx, char) => {
                ctx.emit({ type: "operator", value: "/" });
                ctx.reconsume();
            },
        },
    ],

    // line comments
    commentLine: [
        {
            condition: "\n",
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "comment", value: buffer });
            },
        },
        {
            condition: () => true,
            action: (ctx, char) => ctx.append(char),
        },
    ],

    // block comments
    commentBlock: [
        {
            condition: "*",
            next: "commentBlockEnd",
        },
        {
            condition: () => true,
            action: (ctx, char) => ctx.append(char),
        },
    ],

    commentBlockEnd: [
        {
            condition: "/",
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "comment", value: buffer });
            },
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

    // operators (multi-character support)
    operator: [
        {
            condition: /[=<>!&|+\-*\/%]/,
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
    const lexer = new Lexer<CTX, JSToken>(
        jsRules,
        "data",
        {}
    );

    return lexer.run(value);
}