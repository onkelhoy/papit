import {describe, it, beforeEach} from "node:test";
import assert from "node:assert";

import {Query, Document, Node} from "@papit/html";

describe("Node / Element", () => {

    describe("Node", () => {
        it("should have default node relationships", () => {
            const doc = new Document();
            const node = doc.createElement("div");

            assert.strictEqual(node.parentNode, null);
            assert.strictEqual(node.parentElement, null);
            assert.strictEqual(node.childNodes.length, 0);
            assert.strictEqual(node.ownerDocument, doc);
        });
    });

    describe("Text", () => {
        it("should store text content", () => {
            const doc = new Document();
            const text = doc.createTextNode("hello");

            assert.strictEqual(text.textContent, "hello");
            assert.strictEqual(text.nodeType, Node.TEXT_NODE);
        });
    });

    describe("Comment", () => {
        it("should parse comment", () => {
            const doc = new Document();
            doc.innerHTML = `
        <!-- comment1 -->
        <!-- comment2 -->
        <div>Hello World</div>
      `;

            assert.strictEqual(doc.childNodes.length, 3);
            assert.strictEqual(doc.childNodes.item(0).nodeName, "COMMENT_NODE", "comment.nodeName != COMMENT_NODE");
            assert.strictEqual(doc.childNodes.item(0).textContent, "comment1", `"${doc.childNodes.item(0).textContent}" != "comment1"`);
            assert.strictEqual(doc.childNodes.item(1).textContent, "comment2");
            assert.strictEqual(doc.documentElement.tagName, "div");
        });

        it("should parse comment with doctype", () => {
            const doc = new Document();
            doc.innerHTML = `
        <!doctype html>
        <!-- comment1 -->
        <!-- comment2 -->
        <div>Hello World</div>
      `;

            console.log(doc.childNodes.item(0).nodeName);
            assert.strictEqual(doc.childNodes.length, 4);
            assert.strictEqual(doc.childNodes.item(0).nodeName, "DOCUMENT_TYPE_NODE", doc.childNodes.item(0).nodeName);
            assert.strictEqual(doc.childNodes.item(0).name, "html");
            assert.strictEqual(doc.childNodes.item(1).textContent, "comment1", `"${doc.childNodes.item(0).textContent}" != "comment1"`);
            assert.strictEqual(doc.childNodes.item(2).textContent, "comment2");
            assert.strictEqual(doc.documentElement.tagName, "div");
            assert.strictEqual(doc.outerHTML, "<!DOCTYPE html><!-- comment1 --><!-- comment2 --><div>Hello World</div>");

        });
    })

    describe("Element", () => {
        let doc;
        let el;

        beforeEach(() => {
            doc = new Document();
            el = doc.createElement("div");

            el.id = "main";
            el.classList.add("foo", "bar");
        });

        it("should store tagName, attributes, and className", () => {
            assert.strictEqual(el.tagName, "div");
            assert.strictEqual(el.getAttribute("id"), "main");
            assert.strictEqual(el.classList.length, 2);
            assert.strictEqual(el.className, "foo bar");

            assert(el.classList.contains("foo"));
            assert(el.classList.contains("bar"));
        });

        it("should append and remove children", () => {
            const child = doc.createElement("span");

            el.appendChild(child);
            assert.strictEqual(el.children.length, 1);
            assert.strictEqual(el.children[0], child);

            el.removeChild(child);
            assert.strictEqual(el.children.length, 0);
            assert.strictEqual(child.parentNode, null);
        });

        it("should compute innerHTML and outerHTML", () => {
            const span = doc.createElement("span");
            span.setAttribute("title", "hi");

            const text = doc.createTextNode("Hello");
            span.appendChild(text);
            el.appendChild(span);

            assert.strictEqual(span.getAttribute("title"), "hi", "span does not have title=hi");

            const expectedInner = '<span title="hi">Hello</span>';
            const expectedOuter =
                '<div id="main" class="foo bar">' + expectedInner + '</div>';

            assert.strictEqual(el.innerHTML, expectedInner, "expected inner failed");
            assert.strictEqual(el.outerHTML, expectedOuter, "expected outer failed");
        });

        it("should update innerHTML and rebuild children", () => {
            el.innerHTML = "<span>Test</span>";

            assert.strictEqual(el.children.length, 1);
            assert.strictEqual(el.children[0].tagName, "span");
            assert.strictEqual(
                el.children[0].childNodes.item(0).textContent,
                "Test"
            );
        });

        it("should querySelector and querySelectorAll", () => {
            const child1 = doc.createElement("span");
            child1.id = "a";
            child1.classList.add("foo");

            const child2 = doc.createElement("span");
            child2.id = "b";
            child2.classList.add("bar");

            el.appendChild(child1);
            el.appendChild(child2);

            const found = el.querySelector("#a");
            assert.strictEqual(found, child1);

            const allSpans = el.querySelectorAll("span");
            assert.strictEqual(allSpans.length, 2);
        });

        it("should find closest matching ancestor", () => {
            const parent = doc.createElement("div");
            parent.id = "parent";

            const child = doc.createElement("span");
            const grandChild = doc.createElement("em");

            parent.appendChild(child);
            child.appendChild(grandChild);

            assert.strictEqual(grandChild.closest("#parent"), parent);
        });
    });

    describe("Document", () => {
        let doc;

        beforeEach(() => {
            doc = new Document();
        });

        it("should create text nodes and elements", () => {
            const text = doc.createTextNode("hello");
            assert.strictEqual(text.textContent, "hello", "text content is not hello");

            const el = doc.createElement("div");
            assert.strictEqual(el.tagName, "div", "tag name is not div");
            assert.strictEqual(el.ownerDocument, doc, "ownerDocument is not doc");
        });

        it("should build deep tree manually", () => {

            // NOTE this example is comming from live-server - it had problems
            doc.appendChild(doc.createElement("body"));

            const folders = doc.createElement("ul");
            doc.body.appendChild(folders);
            const files = doc.createElement("ul");
            doc.body.appendChild(files);

            new Array(10).fill(0).forEach((_v, index) => {
                const li = doc.createElement("li");

                const iconspan = doc.createElement("span");
                li.appendChild(iconspan);

                const namespan = doc.createElement("span");
                li.appendChild(namespan);

                namespan.textContent = index;

                assert.strictEqual(namespan.textContent, String(index));


                if (index < 5) folders.appendChild(li);
                else files.appendChild(li);
            });

            assert.strictEqual(folders.children.length, 5);
            assert.strictEqual(files.children.length, 5);

            assert.strictEqual(doc.innerHTML, "<body><ul><li><span /><span>0</span></li><li><span /><span>1</span></li><li><span /><span>2</span></li><li><span /><span>3</span></li><li><span /><span>4</span></li></ul><ul><li><span /><span>5</span></li><li><span /><span>6</span></li><li><span /><span>7</span></li><li><span /><span>8</span></li><li><span /><span>9</span></li></ul></body>")
        })

        it("should build tree from innerHTML", () => {
            doc.innerHTML = "<div><span>Hi</span></div>";

            const div = doc.children[0];
            const span = div.children[0];
            const text = span.childNodes.item(0);

            assert.strictEqual(div.tagName, "div");
            assert.strictEqual(span.tagName, "span");
            assert.strictEqual(text.textContent, "Hi");
        });

        it("should get documentElement, doctype, title, body, head", () => {
            doc.innerHTML = `
        <!doctype html>
        <html>
          <head>
            <title>Hello World</title>
          </head>
          <body>
            alright 
          </body>
        <html>
      `;

            assert.ok(!!doc.documentElement, "documentElement is missing");
            assert.strictEqual(doc.documentElement.tagName, "html");
            assert.ok(!!doc.doctype, "doctype is missing");
            assert.strictEqual(doc.doctype.name, "html");
            assert.ok(!!doc.head, "head is missing");
            assert.ok(!!doc.title, "title is missing");
            assert.strictEqual(doc.title, "Hello World");
            assert.ok(!!doc.body, "body is missing");
            assert.ok(doc.body.textContent, "alright");
        });


        it("should assign title", () => {
            doc.innerHTML = `
        <!doctype html>
        <html>
          <head>
            <title>Hello World</title>
          </head>
          <body>
            alright 
          </body>
        <html>
      `;

            assert.ok(!!doc.title, "title is missing");
            assert.strictEqual(doc.title, "Hello World");

            doc.title = "hejsan banan";
            assert.strictEqual(doc.title, "hejsan banan");
        });
    });

    describe("Mutable", () => {
        it("should mutate textContent", () => {
            const node = new Node();
            const child = new Node();
            child.textContent = "hello";
            node.appendChild(child);

            assert.strictEqual(node.textContent, "hello");
            child.textContent = "world";
            assert.strictEqual(node.textContent, "world");
        });

        it("should mutate innerHTML", () => {
            const document = new Document();
            const div = document.createElement("div");
            document.appendChild(div);

            const span = document.createElement("span");
            div.appendChild(span);

            assert.strictEqual(document.outerHTML, "<div><span /></div>");

            span.innerHTML = "<p>bajskorvar</p>";
            assert.strictEqual(document.outerHTML, "<div><span><p>bajskorvar</p></span></div>");

            span.setAttribute("bajs", "korv");
            assert.strictEqual(document.outerHTML, "<div><span bajs=\"korv\"><p>bajskorvar</p></span></div>");
        });
    });

    describe("className", () => {
        let doc;

        beforeEach(() => {
            doc = new Document();
        });

        it("should have classNames", () => {
            const bob = doc.createElement("bob");
            bob.className = "hello world";
            assert.strictEqual(bob.classList.length, 2);
            assert.strictEqual(bob.classList.contains("hello"), true);
            assert.strictEqual(bob.classList.contains("world"), true);
        });

        it("should have classNames from innerHTML", () => {
            doc.innerHTML = `
        <bob class="hello world"></bo>
      `
            const bob = doc.querySelector("bob");
            assert.strictEqual(bob.className, "hello world");
            assert.strictEqual(bob.classList.length, 2);
            assert.strictEqual(bob.classList.contains("hello"), true);
            assert.strictEqual(bob.classList.contains("world"), true);
        });
    })

    describe("querySelector", () => {
        let doc;

        beforeEach(() => {
            doc = new Document();
            doc.innerHTML = `
        <body>
          <p>text 1</p>
          <p>text 2 <span class="hello world">span 1</span><span id="wow">span 2</span></p>
          <p>text 3 <br class="hello" /></p>
          <p>text 4 <br /></p>
          <a foo="bar">anchor 1</a>
          <a foo="baz">anchor 2</a>
          <span class="hello[world]">hello world</span>
        </body>
      `;
        });

        it("should perform simple querySelector", () => {
            const p = doc.querySelector("p");
            assert.strictEqual(p.innerHTML, "text 1");
        });

        it("should perform querySelector with attribute", () => {
            const a0 = doc.querySelector("a");
            assert.strictEqual(a0.innerHTML, "anchor 1");

            const a1 = doc.querySelector("[foo]");
            assert.strictEqual(a1.innerHTML, "anchor 1");

            const a2 = doc.querySelector('[foo="baz"]');
            assert.strictEqual(a2.innerHTML, "anchor 2");
        });

        it("should perform querySelector with class", () => {
            const span = doc.querySelector("span");
            assert.strictEqual(span.className, "hello world");
            assert.strictEqual(span.classList.contains("hello"), true);

            const p = doc.querySelector(".hello");
            assert.strictEqual(p.innerHTML, "span 1");
        });

        it("should perform querySelectorAll", () => {
            const p = doc.querySelectorAll("p");
            assert.strictEqual(p.length, 4);
            assert.strictEqual(p[0].innerHTML, "text 1");
            assert.strictEqual(p[1].innerHTML, "text 2<span class=\"hello world\">span 1</span><span id=\"wow\">span 2</span>");
            assert.strictEqual(p[2].innerHTML, "text 3<br class=\"hello\" />");
            assert.strictEqual(p[3].innerHTML, "text 4<br />");
        });

        it("should perform querySelector by class", () => {
            const p = doc.querySelectorAll(".hello");
            assert.strictEqual(p.length, 2);
            assert.strictEqual(p[0].tagName, "span");
            assert.strictEqual(p[1].tagName, "br");
        });

        it("should access same element multiple times", () => {
            assert.strictEqual(doc.querySelector("body > p").innerHTML, "text 1")
            assert.strictEqual(doc.querySelector("body > p").innerHTML, "text 1")
            assert.strictEqual(doc.querySelector("body > p").innerHTML, "text 1")
            assert.strictEqual(doc.querySelector("body > p").innerHTML, "text 1")
        });

        it.skip("should access based on className with brackets", () => {
            const element = doc.querySelector("span.hello[world]");
            assert.strictEqual(element.innerHTML, "hello world")
        });
    });

    describe.only("edge cases", () => {
        let doc;

        beforeEach(() => {
            doc = new Document();
        });

        it("should parse with tag that has no content", () => {
            doc.innerHTML = `
        <html>
          <div></div>
          <div>hejsan</div>
          <div/>
        </html>
      `;

            assert.strictEqual(doc.documentElement.children.length, 3);
            assert.strictEqual(doc.innerHTML, "<html><div /><div>hejsan</div><div /></html>");
        });

        it("should parse with script tag", () => {
            doc.innerHTML = `
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Core Decorator test</title>

            <script defer src="main.js"></script>
          </head>

          <body>
            <core-decorators data-testid="a"></core-decorators>
            <core-decorators data-testid="b" initial-value-2="initial-attribute"></core-decorators>
          </body>

        </html>
      `;

            assert.strictEqual(doc.innerHTML, '<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Core Decorator test</title><script defer src="main.js"></script></head><body><core-decorators data-testid="a"></core-decorators><core-decorators data-testid="b" initial-value-2="initial-attribute"></core-decorators></body></html>')

            assert.strictEqual(doc.documentElement.children.length, 2);
            assert.strictEqual(doc.body.children.length, 2);
            assert.strictEqual(doc.head.children.length, 4);
        });
    })
});
