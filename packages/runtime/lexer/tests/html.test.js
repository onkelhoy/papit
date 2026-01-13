import {describe, it} from "node:test";
import assert from "node:assert";
import {html as lexer} from "@papit/lexer";

describe("html", () => {

  describe("text", () => {
    it("should tokenize plain text", () => {
      const html = "hello world";
      const tokens = lexer(html);
      assert.deepStrictEqual(tokens, [{type: "text", value: "hello world"}]);
    });
  });

  describe("doctype", () => {
    it("should tokenize a simple doctype", () => {
      const html = "<!comment>";
      const tokens = lexer(html);

      assert.deepStrictEqual(tokens, [
        {type: "doctype", value: "comment"}
      ]);
    });

    it("should tokenize a doctype with spaces", () => {
      const html = "<!this is a doctype>";
      const tokens = lexer(html);

      assert.deepStrictEqual(tokens, [
        {type: "doctype", value: "this is a doctype"}
      ]);
    });
    it("should tokenize doctype inside elements", () => {
      const html = "<div>Hi<!note>There</div>";
      const tokens = lexer(html);

      assert.deepStrictEqual(tokens, [
        {type: "startTag", name: "div", attributes: {}, selfClosing: false},
        {type: "text", value: "Hi"},
        {type: "doctype", value: "note"},
        {type: "text", value: "There"},
        {type: "endTag", name: "div"}
      ]);
    });
    it("should tokenize multiple doctype", () => {
      const html = "<!a><!b><!c>";
      const tokens = lexer(html);

      assert.deepStrictEqual(tokens, [
        {type: "doctype", value: "a"},
        {type: "doctype", value: "b"},
        {type: "doctype", value: "c"}
      ]);
    });

    it("should allow symbols inside doctype", () => {
      const html = "<!@#$%^&*()>";
      const tokens = lexer(html);

      assert.deepStrictEqual(tokens, [
        {type: "doctype", value: "@#$%^&*()"}
      ]);
    });

    it("should not fall through from doctype into TagName", () => {
      const html = "<!test>";
      const tokens = lexer(html);

      assert.strictEqual(tokens.length, 1);
      assert.strictEqual(tokens[0].type, "doctype");
    });
  })

  describe("comment", () => {
    it("supports HTML <!-- --> comments", () => {
      const html = "<!-- hello -->";
      const tokens = lexer(html);

      // current tokenizer behavior
      assert.deepStrictEqual(tokens, [
        {type: "comment", value: "hello"}
      ]);
    });
  });

  describe("tags", () => {
    it("should tokenize a simple tag", () => {
      const html = "<div>";
      const tokens = lexer(html);
      assert.deepStrictEqual(tokens, [
        {type: "startTag", name: "div", attributes: {}, selfClosing: false}
      ]);
    });

    it("should tokenize self-closing tags", () => {
      const html = `<img src="pic.jpg" />`;
      const tokens = lexer(html);
      assert.deepStrictEqual(tokens, [
        {type: "startTag", name: "img", attributes: {src: "pic.jpg"}, selfClosing: true}
      ]);
    });

    it("should tokenize end tags", () => {
      const html = "</div>";
      const tokens = lexer(html);
      assert.deepStrictEqual(tokens, [
        {type: "endTag", name: "div"}
      ]);
    });

    it("should tokenize mixed content", () => {
      const html = `<div>Hello <span>World</span>!</div>`;
      const tokens = lexer(html);
      assert.deepStrictEqual(tokens, [
        {type: "startTag", name: "div", attributes: {}, selfClosing: false},
        {type: "text", value: "Hello "},
        {type: "startTag", name: "span", attributes: {}, selfClosing: false},
        {type: "text", value: "World"},
        {type: "endTag", name: "span"},
        {type: "text", value: "!"},
        {type: "endTag", name: "div"}
      ]);
    });
  });

  describe("attributes", () => {
    it("should tokenize a tag with attributes", () => {
      const html = `<div id="foo" hidden class='bar'>`;
      const tokens = lexer(html);
      assert.deepStrictEqual(tokens, [
        {
          type: "startTag",
          name: "div",
          attributes: {id: "foo", hidden: true, class: "bar"},
          selfClosing: false
        }
      ]);
    });

    it("should tokenize a tag with attribute that has spaces", () => {
      const html = `<div id="foo" hidden class='foo bar'>`;
      const tokens = lexer(html);
      assert.deepStrictEqual(tokens, [
        {
          type: "startTag",
          name: "div",
          attributes: {id: "foo", hidden: true, class: "foo bar"},
          selfClosing: false
        }
      ]);
    });

    it("should handle unquoted attribute values", () => {
      const html = `<input type=text disabled>`;
      const tokens = lexer(html);
      assert.deepStrictEqual(tokens, [
        {type: "startTag", name: "input", attributes: {type: "text", disabled: true}, selfClosing: false}
      ]);
    });
  });
});
