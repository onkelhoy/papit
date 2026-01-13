import {describe, it} from "node:test";
import assert from "node:assert";
import {markdown as lexer} from "@papit/lexer";

describe.skip("markdown", () => {
    describe("text", () => {
        it("should parse simple text", () => {
            const tokens = lexer("hello world");
            assert.deepStrictEqual(tokens, [{type: "paragraph", text: "hello world"}]);
        });

        it("should parse text with bold", () => {
            const tokens = lexer("hello **world**");
            assert.deepStrictEqual(tokens, [{type: "paragraph", text: "hello **world**"}]);
        });

        it("should parse text with italic", () => {
            const tokens = lexer("hello *world*");
            assert.deepStrictEqual(tokens, [{type: "paragraph", text: "hello *world*"}]);
        });

        it("should parse text with bold and italic", () => {
            const tokens = lexer("hello *wo**r**ld*");
            assert.deepStrictEqual(tokens, [{type: "paragraph", text: "hello *wo**r**ld*"}]);
        });

        it("should parse text with hashtag", () => {
            const tokens = lexer("hello #funny");
            assert.deepStrictEqual(tokens, [{type: "paragraph", text: "hello #funny"}]);
        });

        it("should parse text for what looks like header", () => {
            const tokens = lexer("#hello world");
            assert.deepStrictEqual(tokens, [{type: "paragraph", text: "#hello world"}]);
        });
    });

    describe("headers", () => {
        it("should parse simple level 1 header", () => {
            const tokens = lexer("# hello world");
            assert.deepStrictEqual(tokens, [{type: "heading", level: 1, text: "hello world"}]);
        });

        it("should parse simple level 2 header", () => {
            const tokens = lexer("## hello world");
            assert.deepStrictEqual(tokens, [{type: "heading", level: 2, text: "hello world"}]);
        });

        it("should parse simple level 5 header", () => {
            const tokens = lexer("##### hello world");
            assert.deepStrictEqual(tokens, [{type: "heading", level: 5, text: "hello world"}]);
        });
    });

    describe("quote", () => {
        it("should parse a simple qoute", () => {
            const tokens = lexer("> hello world");
            assert.deepStrictEqual(tokens, [{type: "quote", text: "hello world"}]);
        });

        it.only("should parse a multiline qoute", () => {
            const tokens = lexer(`
        > hello world
        >        
        > hello world  
      `);
            assert.deepStrictEqual(tokens, [{type: "quote", text: "hello world\n\nhello world"}]);
        });
    })
});
