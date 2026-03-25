import {describe, it} from "node:test";
import assert from "node:assert";
import {css as lexer} from "@papit/lexer";

describe("css", () => {

    describe("selectors", () => {
        it("should tokenize a simple selector", () => {
            const input = "body {";
            const tokens = lexer(input);

            assert.deepStrictEqual(tokens, [
                {type: "selector", value: "body"},
                {type: "braceOpen"}
            ]);
        });

        it("should handle complex selectors", () => {
            const input = "div .class#id:hover {";
            const tokens = lexer(input);

            assert.deepStrictEqual(tokens, [
                {type: "selector", value: "div .class#id:hover"},
                {type: "braceOpen"}
            ]);
        });
    });

    describe("properties and values", () => {
        it("should tokenize a simple declaration", () => {
            const input = "body { color: red; }";
            const tokens = lexer(input);

            assert.deepStrictEqual(tokens, [
                {type: "selector", value: "body"},
                {type: "braceOpen"},
                {type: "property", value: "color"},
                {type: "colon"},
                {type: "value", value: "red"},
                {type: "semicolon"},
                {type: "braceClose"}
            ]);
        });

        it("should handle multiple declarations", () => {
            const input = "body { color: red; background: blue; }";
            const tokens = lexer(input);

            assert.deepStrictEqual(tokens, [
                {type: "selector", value: "body"},
                {type: "braceOpen"},

                {type: "property", value: "color"},
                {type: "colon"},
                {type: "value", value: "red"},
                {type: "semicolon"},

                {type: "property", value: "background"},
                {type: "colon"},
                {type: "value", value: "blue"},
                {type: "semicolon"},

                {type: "braceClose"}
            ]);
        });

        it("should allow missing semicolon on last property", () => {
            const input = "body { color: red }";
            const tokens = lexer(input);

            assert.deepStrictEqual(tokens, [
                {type: "selector", value: "body"},
                {type: "braceOpen"},
                {type: "property", value: "color"},
                {type: "colon"},
                {type: "value", value: "red"},
                {type: "braceClose"}
            ]);
        });
    });

    describe("comments", () => {
        it("should tokenize a simple comment", () => {
            const input = "/* hello */";
            const tokens = lexer(input);

            assert.deepStrictEqual(tokens, [
                {type: "comment", value: " hello "}
            ]);
        });

        it("should handle comment inside rule", () => {
            const input = "body { color: red; /* hi */ background: blue; }";
            const tokens = lexer(input);

            assert.strictEqual(tokens.some(t => t.type === "comment"), true);
        });

        it("should handle multiline comments", () => {
            const input = `/* 
        hello
        world
      */`;

            const tokens = lexer(input);

            assert.strictEqual(tokens.length, 1);
            assert.strictEqual(tokens[0].type, "comment");
            assert.ok(tokens[0].value.includes("hello"));
        });
    });

    describe("at-rules", () => {
        it("should tokenize inline at-rule", () => {
            const input = '@import url("style.css");';
            const tokens = lexer(input);

            assert.deepStrictEqual(tokens, [
                {type: "atRule", value: '@import url("style.css")'},
                {type: "semicolon"}
            ]);
        });

        it("should tokenize block at-rule", () => {
            const input = "@media screen { body { color: red; } }";
            const tokens = lexer(input);

            assert.strictEqual(tokens[0].type, "atRule");
            assert.strictEqual(tokens[1].type, "braceOpen");
        });
    });

    describe("edge cases", () => {
        it("should handle empty input", () => {
            const tokens = lexer("");
            assert.deepStrictEqual(tokens, []);
        });

        it("should handle whitespace-only input", () => {
            const tokens = lexer("   \n  ");
            assert.deepStrictEqual(tokens, []);
        });

        it("should not crash on malformed css", () => {
            const input = "body { color red ";
            const tokens = lexer(input);

            assert.ok(Array.isArray(tokens));
        });
    });

});