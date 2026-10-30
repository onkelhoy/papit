import {describe, it} from "node:test";
import assert from "node:assert";
import {markdown, markdownInline as inline} from "@papit/lexer";

const text = value => ({type: "text", text: value});

describe("markdown", () => {

    describe("blocks", () => {
        it("should tokenize ATX and setext headings", () => {
            assert.deepStrictEqual(markdown("# One\n## Two ##\nThree\n---"), [
                {type: "heading", level: 1, children: [text("One")]},
                {type: "heading", level: 2, children: [text("Two")]},
                {type: "heading", level: 2, children: [text("Three")]},
            ]);
        });

        it("should keep #word as a paragraph", () => {
            assert.deepStrictEqual(markdown("#funny"), [{type: "paragraph", children: [text("#funny")]}]);
        });

        it("should join lines into one paragraph and split on blank lines", () => {
            assert.deepStrictEqual(markdown("a\nb\n\nc"), [
                {type: "paragraph", children: [text("a\nb")]},
                {type: "paragraph", children: [text("c")]},
            ]);
        });

        it("should tokenize fenced code with its language, nothing inside parsed", () => {
            assert.deepStrictEqual(markdown("```js\nconst a = **1**;\n\n```"), [
                {type: "code", lang: "js", text: "const a = **1**;\n"},
            ]);
        });

        it("should run an unclosed fence to the end", () => {
            assert.deepStrictEqual(markdown("~~~\nx"), [{type: "code", lang: "", text: "x"}]);
        });

        it("should tokenize indented code", () => {
            assert.deepStrictEqual(markdown("    a\n    b"), [{type: "code", lang: "", text: "a\nb"}]);
        });

        it("should nest quotes", () => {
            assert.deepStrictEqual(markdown("> a\n> > b"), [
                {type: "quote", children: [
                    {type: "paragraph", children: [text("a")]},
                    {type: "quote", children: [{type: "paragraph", children: [text("b")]}]},
                ]},
            ]);
        });

        it("should tokenize rules", () => {
            assert.deepStrictEqual(markdown("***\n- - -"), [{type: "rule"}, {type: "rule"}]);
        });

        it("should tokenize a tight unordered list", () => {
            assert.deepStrictEqual(markdown("- a\n- b"), [
                {type: "list", ordered: false, start: 1, loose: false, items: [
                    {checked: undefined, children: [{type: "paragraph", children: [text("a")]}]},
                    {checked: undefined, children: [{type: "paragraph", children: [text("b")]}]},
                ]},
            ]);
        });

        it("should keep the start of an ordered list and mark a loose one", () => {
            const [list] = markdown("3. a\n\n4. b");
            assert.strictEqual(list.ordered, true);
            assert.strictEqual(list.start, 3);
            assert.strictEqual(list.loose, true);
            assert.strictEqual(list.items.length, 2);
        });

        it("should nest lists by indentation", () => {
            const [list] = markdown("- a\n  - b\n- c");
            assert.strictEqual(list.items.length, 2);
            assert.strictEqual(list.items[0].children[1].type, "list");
        });

        it("should read task items", () => {
            const [list] = markdown("- [x] done\n- [ ] todo");
            assert.deepStrictEqual(list.items.map(item => item.checked), [true, false]);
            assert.deepStrictEqual(list.items[0].children, [{type: "paragraph", children: [text("done")]}]);
        });

        it("should tokenize a table with alignment", () => {
            assert.deepStrictEqual(markdown("| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 \\| 3 |"), [
                {
                    type: "table",
                    align: ["left", "center", "right"],
                    head: [[text("a")], [text("b")], [text("c")]],
                    rows: [[[text("1")], [text("2 | 3")], []]],
                },
            ]);
        });

        it("should keep raw HTML as text", () => {
            assert.deepStrictEqual(markdown("<script>x</script>"), [
                {type: "paragraph", children: [text("<script>x</script>")]},
            ]);
        });
    });

    describe("inline", () => {
        it("should tokenize strong, em and del", () => {
            assert.deepStrictEqual(inline("**a** *b* _c_ ~~d~~"), [
                {type: "strong", children: [text("a")]}, text(" "),
                {type: "em", children: [text("b")]}, text(" "),
                {type: "em", children: [text("c")]}, text(" "),
                {type: "del", children: [text("d")]},
            ]);
        });

        it("should nest marks", () => {
            assert.deepStrictEqual(inline("*a **b** c*"), [
                {type: "em", children: [text("a "), {type: "strong", children: [text("b")]}, text(" c")]},
            ]);
        });

        it("should leave spaced and intraword marks alone", () => {
            assert.deepStrictEqual(inline("2 * 3 * 4"), [text("2 * 3 * 4")]);
            assert.deepStrictEqual(inline("snake_case_name"), [text("snake_case_name")]);
        });

        it("should tokenize code spans, nothing inside parsed", () => {
            assert.deepStrictEqual(inline("a `**b**` ``c ` d``"), [
                text("a "), {type: "code", text: "**b**"}, text(" "), {type: "code", text: "c ` d"},
            ]);
        });

        it("should tokenize links with titles and images", () => {
            assert.deepStrictEqual(inline('[a *b*](/x "T") ![alt](i.png)'), [
                {type: "link", href: "/x", title: "T", children: [text("a "), {type: "em", children: [text("b")]}]},
                text(" "),
                {type: "image", src: "i.png", alt: "alt"},
            ]);
        });

        it("should tokenize autolinks and bare URLs without trailing punctuation", () => {
            assert.deepStrictEqual(inline("<mailto:a@b.c> see https://x.com/a."), [
                {type: "link", href: "mailto:a@b.c", children: [text("a@b.c")]},
                text(" see "),
                {type: "link", href: "https://x.com/a", children: [text("https://x.com/a")]},
                text("."),
            ]);
        });

        it("should handle escapes and hard breaks", () => {
            assert.deepStrictEqual(inline("\\*a\\*  \nb\\\nc"), [
                text("*a*"), {type: "break"}, text("b"), {type: "break"}, text("c"),
            ]);
        });
    });
});
