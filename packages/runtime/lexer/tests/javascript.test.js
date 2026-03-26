import { describe, it } from "node:test";
import assert from "node:assert";
import { js as lexer } from "@papit/lexer";

// strips whitespace tokens for tests that care only about semantic tokens
function sem(input) {
    return lexer(input).filter(t => t.type !== "whitespace");
}

describe.only("javascript", () => {

    describe("basic tokens", () => {
        it("should tokenize identifiers and keywords", () => {
            const tokens = sem("const x = 10");

            assert.deepStrictEqual(tokens, [
                { type: "keyword", value: "const" },
                { type: "identifier", value: "x" },
                { type: "operator", value: "=" },
                { type: "number", value: "10" }
            ]);
        });

        it("should distinguish keywords from identifiers", () => {
            const tokens = sem("function myFunc");

            assert.deepStrictEqual(tokens, [
                { type: "keyword", value: "function" },
                { type: "identifier", value: "myFunc" }
            ]);
        });
    });

    describe("operators", () => {
        it("should tokenize single and multi-char operators", () => {
            const tokens = sem("a === b !== c => d");

            assert.deepStrictEqual(tokens, [
                { type: "identifier", value: "a" },
                { type: "operator", value: "===" },
                { type: "identifier", value: "b" },
                { type: "operator", value: "!==" },
                { type: "identifier", value: "c" },
                { type: "operator", value: "=>" },
                { type: "identifier", value: "d" }
            ]);
        });
    });

    describe("strings", () => {
        it("should tokenize double quoted strings", () => {
            const tokens = lexer('const x = "hello"');
            assert.ok(tokens.some(t => t.type === "string" && t.value === "hello"));
        });

        it("should tokenize single quoted strings", () => {
            const tokens = lexer("const x = 'hello'");
            assert.ok(tokens.some(t => t.type === "string" && t.value === "hello"));
        });

        it("should handle escaped quotes", () => {
            const tokens = lexer('const x = "he\\\"llo"');
            assert.ok(tokens.some(t => t.type === "string"));
        });
    });

    describe("numbers", () => {
        it("should tokenize integers", () => {
            const tokens = lexer("let x = 42");
            assert.ok(tokens.some(t => t.type === "number" && t.value === "42"));
        });

        it("should tokenize decimals", () => {
            const tokens = lexer("let x = 3.14");
            assert.ok(tokens.some(t => t.type === "number" && t.value === "3.14"));
        });
    });

    describe("comments", () => {
        it("should tokenize line comments", () => {
            const tokens = lexer("let x = 1 // comment");
            assert.ok(tokens.some(t => t.type === "comment"));
        });

        it("should tokenize block comments", () => {
            const tokens = sem("/* hello world */");
            assert.deepStrictEqual(tokens, [
                { type: "comment", value: " hello world " }
            ]);
        });

        it("should handle multiline comments", () => {
            const input = `/* 
hello
world
*/`;
            const tokens = lexer(input);
            assert.strictEqual(tokens.filter(t => t.type !== "whitespace").length, 1);
            assert.strictEqual(tokens[0].type, "comment");
            assert.ok(tokens[0].value.includes("hello"));
        });
    });

    describe("punctuation", () => {
        it("should tokenize punctuation", () => {
            const tokens = lexer("function test() { return x; }");
            assert.ok(tokens.some(t => t.type === "punctuation" && t.value === "("));
            assert.ok(tokens.some(t => t.type === "punctuation" && t.value === ")"));
            assert.ok(tokens.some(t => t.type === "punctuation" && t.value === "{"));
        });
    });

    describe("whitespace", () => {
        it("should emit whitespace tokens", () => {
            const tokens = lexer("a b");
            assert.ok(tokens.some(t => t.type === "whitespace" && t.value === " "));
        });

        it("should preserve newlines as whitespace", () => {
            const tokens = lexer("a\nb");
            assert.ok(tokens.some(t => t.type === "whitespace" && t.value === "\n"));
        });
    });

    describe("edge cases", () => {
        it("should handle empty input", () => {
            assert.deepStrictEqual(lexer(""), []);
        });

        it("should handle whitespace-only input (only whitespace tokens)", () => {
            const tokens = lexer("   \n\t ");
            assert.ok(tokens.every(t => t.type === "whitespace"));
        });

        it("should not crash on malformed input", () => {
            const tokens = lexer("const x = 'unclosed string");
            assert.ok(Array.isArray(tokens));
        });
    });
});