import { describe, it } from "node:test";
import assert from "node:assert";
import { Query } from "@papit/html";


describe("Query", () => {

  describe("old", () => {
    it("should parse simple tag selectors", () => {
      const result = Query("div");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].tag, "div");
      assert.strictEqual(result[0].class, undefined);
      assert.strictEqual(result[0].attribute, undefined);
      assert.strictEqual(result[0].text, undefined);
    });

    it("should parse class selectors", () => {
      const result = Query(".foo");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].tag, undefined);
      assert.deepStrictEqual(result[0].class, ["foo"]);
    });

    it("should parse tag with class", () => {
      const result = Query("div.bar");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].tag, "div");
      assert.deepStrictEqual(result[0].class, ["bar"]);
    });

    it("should parse attributes", () => {
      const result = Query("[id=main]");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].attribute?.name, "id");
      assert.strictEqual(result[0].attribute?.value, "main");
    });

    it("should parse text selectors", () => {
      const result = Query("{Hello}");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].text, "Hello");
    });

    it("should handle combined selectors", () => {
      const result = Query("div.bar[baz=qux]{Hello}");
      const part = result[0];

      assert.strictEqual(part.tag, "div");
      assert.deepStrictEqual(part.class, ["bar"]);
      assert.strictEqual(part.attribute?.name, "baz");
      assert.strictEqual(part.attribute?.value, "qux");
      assert.strictEqual(part.text, "Hello");
    });

    it("should split multiple selectors separated by space, >, or +", () => {
      const result = Query("div > span + .foo");

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].tag, "div");
      assert.strictEqual(result[0].relation, "child");
      assert.strictEqual(result[1].tag, "span");
      assert.deepStrictEqual(result[1].relation, "sibling");
      assert.deepStrictEqual(result[2].class, ["foo"]);
    });

    it("should ignore empty parts", () => {
      const result = Query("   div   ");

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].tag, "div");
    });
  });

  it("should parse a simple tag", () => {
    const result = Query("div");
    assert.deepStrictEqual(result, [{ tag: "div" }]);
  });

  it("should parse tag with class", () => {
    const result = Query("div.foo");
    assert.deepStrictEqual(result, [{ tag: "div", class: ["foo"] }]);
  });

  it("should parse tag with id", () => {
    const result = Query("div#bar");
    assert.deepStrictEqual(result, [{ tag: "div", id: "bar" }]);
  });

  it("should parse tag with attribute", () => {
    const result = Query('input[type="text"]');
    assert.deepStrictEqual(result, [{ tag: "input", attribute: { name: "type", value: "text" } }]);
  });

  it("should parse bare attribute", () => {
    const result = Query('[type]');
    assert.deepStrictEqual(result, [{ attribute: { name: "type", value: true } }]);
  });

  it("should parse tag with text", () => {
    const result = Query("div{hello}");
    assert.deepStrictEqual(result, [{ tag: "div", text: "hello" }]);
  });

  it("should parse child combinator >", () => {
    const result = Query("div > span");
    assert.deepStrictEqual(result, [
      { tag: "div", relation: "child" },
      { tag: "span" },
    ]);
  });

  it("should parse sibling combinator +", () => {
    const result = Query("div + span");
    assert.deepStrictEqual(result, [
      { tag: "div", relation: "sibling" },
      { tag: "span" },
    ]);
  });

  it("should parse descendant combinator (space)", () => {
    const result = Query("div span");
    assert.deepStrictEqual(result, [
      { tag: "div", relation: "descendant" },
      { tag: "span" },
    ]);
  });

  it("should handle multiple classes and attributes", () => {
    const result = Query('div.foo.bar[id="main"]');
    assert.deepStrictEqual(result, [
      { tag: "div", class: ["foo", "bar"], attribute: { name: "id", value: "main" } }
    ]);
  });

  it("should ignore extra spaces", () => {
    const result = Query("  div   >   span  ");
    assert.deepStrictEqual(result, [
      { tag: "div", relation: "child" },
      { tag: "span" },
    ]);
  });

  it("should parse a deep nested query with children", () => {
    const selector = "first > second > third > fourth";
    const result = Query(selector);

    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].tag, "first");
    assert.strictEqual(result[0].relation, "child");
    assert.strictEqual(result[1].tag, "second");
    assert.strictEqual(result[1].relation, "child");
    assert.strictEqual(result[2].tag, "third");
    assert.strictEqual(result[2].relation, "child");
    assert.strictEqual(result[3].tag, "fourth");
  })

  it("should parse a deep nested query with children, descendants and siblings", () => {
    const selector = "div#root > ul.list li.item + li.item span.icon";

    const result = Query(selector);

    // you can do deep assertions
    assert.strictEqual(result[0].tag, "div");
    assert.strictEqual(result[0].id, "root");
    assert.strictEqual(result[1].tag, "ul");
    assert.deepStrictEqual(result[1].class, ["list"]);

    const li1 = result[2];
    assert.strictEqual(li1.tag, "li");
    assert.deepStrictEqual(li1.class, ["item"]);

    const li2 = result[3];
    assert.strictEqual(li2?.tag, "li");
    assert.deepStrictEqual(li2?.class, ["item"]);

    const span = result[4];
    assert.strictEqual(span?.tag, "span");
    assert.deepStrictEqual(span?.class, ["icon"]);
  });
});
