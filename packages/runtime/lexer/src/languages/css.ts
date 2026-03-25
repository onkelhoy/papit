import { Lexer, type StateRules } from "lexer";

type CTX = {}
export type CSSToken =
    | { type: "selector"; value: string }
    | { type: "property"; value: string }
    | { type: "value"; value: string }
    | { type: "braceOpen" }
    | { type: "braceClose" }
    | { type: "colon" }
    | { type: "semicolon" }
    | { type: "comment"; value: string }
    | { type: "atRule"; value: string };

export const cssRules: StateRules<CTX, CSSToken> = {
    EOF: [
        {
            condition: () => true,
            action: (ctx, char, buffer) => {
                if (buffer.trim())
                {
                    ctx.emit({ type: "selector", value: buffer.trim() });
                }
            },
        },
    ],

    // SELECTORS
    data: [
        {
            condition: "{",
            next: "block",
            action: (ctx, char, buffer) => {
                if (buffer.trim())
                {
                    ctx.emit({ type: "selector", value: buffer.trim() });
                }
                ctx.emit({ type: "braceOpen" });
            },
        },
        {
            condition: "@",
            next: "atRule",
            action: (ctx, char) => ctx.append(char),
        },
        { condition: "/", next: "commentStart" },
        { condition: /\s/, action: (ctx, char) => ctx.append(char) },
        { condition: () => true, action: (ctx, char) => ctx.append(char) },
    ],

    // INSIDE {}
    block: [
        {
            condition: "}",
            next: "data",
            action: (ctx) => ctx.emit({ type: "braceClose" }),
        },
        {
            condition: /\s/,
            action: (ctx, char) => { },
        },
        {
            condition: "/",
            next: "commentStart",
        },
        {
            condition: () => true,
            next: "property",
            action: (ctx, char) => ctx.append(char),
        },
    ],

    // PROPERTY NAME
    property: [
        {
            condition: ":",
            next: "value",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "property", value: buffer.trim() });
                ctx.emit({ type: "colon" });
            },
        },
        {
            condition: /\s/,
            action: () => { },
        },
        {
            condition: () => true,
            action: (ctx, char) => ctx.append(char),
        },
    ],

    // VALUE
    value: [
        {
            condition: ";",
            next: "block",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "value", value: buffer.trim() });
                ctx.emit({ type: "semicolon" });
            },
        },
        {
            condition: "}",
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "value", value: buffer.trim() });
                ctx.emit({ type: "braceClose" });
            },
        },
        {
            condition: "/",
            next: "commentStart",
        },
        {
            condition: () => true,
            action: (ctx, char) => ctx.append(char),
        },
    ],

    // COMMENTS /* ... */
    commentStart: [
        {
            condition: "*",
            next: "comment",
        },
    ],

    comment: [
        {
            condition: "*",
            next: "commentEnd",
        },
        {
            condition: () => true,
            action: (ctx, char) => ctx.append(char),
        },
    ],

    commentEnd: [
        {
            condition: "/",
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "comment", value: buffer });
            },
        },
        {
            condition: () => true,
            next: "comment",
            action: (ctx, char) => {
                ctx.append("*");
                ctx.append(char);
            },
        },
    ],
    atRule: [
        {
            condition: "{",
            next: "block",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "atRule", value: buffer.trim() });
                ctx.emit({ type: "braceOpen" });
            },
        },
        {
            condition: ";",
            next: "data",
            action: (ctx, char, buffer) => {
                ctx.emit({ type: "atRule", value: buffer.trim() });
                ctx.emit({ type: "semicolon" });
            },
        },
        {
            condition: () => true,
            action: (ctx, char) => ctx.append(char),
        },
    ],
};

// Run the lexer
export function css(value: string) {
    const lexer = new Lexer<CTX, CSSToken>(
        cssRules,
        "data",
        {},
    );

    return lexer.run(value);
}
