// import { describe, it } from "node:test";
// import assert from "node:assert";
// import { js as lexer } from "@papit/lexer";

// describe.skip("javascript", () => {

//     describe("basic tokens", () => {
//         it("should tokenize identifiers and keywords", () => {
//             const input = "const x = 10";
//             const tokens = lexer(input);

//             assert.deepStrictEqual(tokens, [
//                 { type: "keyword", value: "const" },
//                 { type: "identifier", value: "x" },
//                 { type: "operator", value: "=" },
//                 { type: "number", value: "10" }
//             ]);
//         });

//         it("should distinguish keywords from identifiers", () => {
//             const input = "function myFunc";
//             const tokens = lexer(input);

//             assert.deepStrictEqual(tokens, [
//                 { type: "keyword", value: "function" },
//                 { type: "identifier", value: "myFunc" }
//             ]);
//         });
//     });

//     describe("operators", () => {
//         it("should tokenize single and multi-char operators", () => {
//             const input = "a === b !== c => d";
//             const tokens = lexer(input);

//             assert.deepStrictEqual(tokens, [
//                 { type: "identifier", value: "a" },
//                 { type: "operator", value: "===" },
//                 { type: "identifier", value: "b" },
//                 { type: "operator", value: "!==" },
//                 { type: "identifier", value: "c" },
//                 { type: "operator", value: "=>" },
//                 { type: "identifier", value: "d" }
//             ]);
//         });
//     });

//     describe("strings", () => {
//         it("should tokenize double quoted strings", () => {
//             const input = 'const x = "hello"';
//             const tokens = lexer(input);

//             assert.ok(tokens.some(t => t.type === "string" && t.value === "hello"));
//         });

//         it("should tokenize single quoted strings", () => {
//             const input = "const x = 'hello'";
//             const tokens = lexer(input);

//             assert.ok(tokens.some(t => t.type === "string" && t.value === "hello"));
//         });

//         it("should handle escaped quotes", () => {
//             const input = 'const x = "he\\\"llo"';
//             const tokens = lexer(input);

//             assert.ok(tokens.some(t => t.type === "string"));
//         });
//     });

//     describe("numbers", () => {
//         it("should tokenize integers", () => {
//             const input = "let x = 42";
//             const tokens = lexer(input);

//             assert.ok(tokens.some(t => t.type === "number" && t.value === "42"));
//         });

//         it("should tokenize decimals", () => {
//             const input = "let x = 3.14";
//             const tokens = lexer(input);

//             assert.ok(tokens.some(t => t.type === "number" && t.value === "3.14"));
//         });
//     });

//     describe("comments", () => {
//         it("should tokenize line comments", () => {
//             const input = "let x = 1 // comment";
//             const tokens = lexer(input);

//             assert.ok(tokens.some(t => t.type === "comment"));
//         });

//         it("should tokenize block comments", () => {
//             const input = "/* hello world */";
//             const tokens = lexer(input);

//             assert.deepStrictEqual(tokens, [
//                 { type: "comment", value: " hello world " }
//             ]);
//         });

//         it("should handle multiline comments", () => {
//             const input = `/* 
// hello
// world
// */`;

//             const tokens = lexer(input);

//             assert.strictEqual(tokens.length, 1);
//             assert.strictEqual(tokens[0].type, "comment");
//             assert.ok(tokens[0].value.includes("hello"));
//         });
//     });

//     describe("punctuation", () => {
//         it("should tokenize punctuation", () => {
//             const input = "function test() { return x; }";
//             const tokens = lexer(input);

//             assert.ok(tokens.some(t => t.type === "punctuation" && t.value === "("));
//             assert.ok(tokens.some(t => t.type === "punctuation" && t.value === ")"));
//             assert.ok(tokens.some(t => t.type === "punctuation" && t.value === "{"));
//         });
//     });

//     describe("edge cases", () => {
//         it("should handle empty input", () => {
//             const tokens = lexer("");
//             assert.deepStrictEqual(tokens, []);
//         });

//         it("should handle whitespace-only input", () => {
//             const tokens = lexer("   \n\t ");
//             assert.deepStrictEqual(tokens, []);
//         });

//         it("should not crash on malformed input", () => {
//             const input = "const x = 'unclosed string";
//             const tokens = lexer(input);

//             assert.ok(Array.isArray(tokens));
//         });
//     });

// });