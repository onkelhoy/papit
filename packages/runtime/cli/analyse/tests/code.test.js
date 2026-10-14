import { describe, it } from "node:test";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

import { analyseFile } from "@papit/analyse";

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}/component.ts`, import.meta.url));
const repo = (relative) => fileURLToPath(new URL(`../../../../${relative}`, import.meta.url));
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object?.[key]]));

describe("analyseFile", () => {
    const get = () => analyseFile(fixture("basic")).find(core => core.className === "Fixture");

    it("finds the custom element class", () => {
        assert.ok(get(), "Fixture class not found");
    });

    it("records extends as the class name and its import source", () => {
        assert.deepStrictEqual(get().extends, { className: "CustomElementInternals", import: "@papit/web-component" });
    });

    it("reads a @property with its decorator options, type, default and JSDoc", () => {
        const label = get().properties.find(p => p.name === "label");
        assert.deepStrictEqual(
            pick(label, ["type", "attribute", "reflect", "converter", "default", "description"]),
            {
                type: "string",
                attribute: "label-text",
                reflect: true,
                converter: "String",
                default: "\"hello\"",
                description: "Text shown in the label.",
            },
        );
    });

    it("reads a protected @property with an attribute, as the attribute is public", () => {
        const property = get().properties.find(p => p.name === "closeoutsideclick");
        assert.deepStrictEqual(
            pick(property, ["type", "attribute", "converter", "default", "description", "visibility"]),
            {
                type: "boolean",
                attribute: "close-outside-click",
                converter: "Boolean",
                default: "false",
                description: "Closes on a backdrop click.",
                visibility: "protected",
            },
        );
    });

    it("leaves out a protected @property without an attribute, private ones and undecorated protected fields", () => {
        const names = get().properties.map(p => p.name);
        for (const name of ["busy", "value", "plain"]) assert.ok(!names.includes(name), name);
    });

    it("leaves visibility out on public properties", () => {
        assert.ok(!("visibility" in get().properties.find(p => p.name === "label")));
    });

    it("reads a dispatched CustomEvent", () => {
        const toggle = get().events.find(e => e.name === "toggle");
        assert.deepStrictEqual(pick(toggle, ["name", "kind"]), { name: "toggle", kind: "CustomEvent" });
    });

    it("lists overload signatures once each, without the implementation", () => {
        const signatures = get().methods.filter(m => m.name === "find").map(m => m.signature);
        assert.deepStrictEqual(signatures, ["(selector: string): Element | null", "(selector: string, all: true): Element[]"]);
    });

    it("strips the {type} from @fires tags", () => {
        const events = get().events;
        assert.deepStrictEqual(events.map(e => e.name), ["toggle"]);
        assert.deepStrictEqual(pick(events[0], ["kind", "description"]), { kind: "CustomEvent", description: "Fired when opened." });
    });

    it("reads @cssprop [--name=default] tags", () => {
        const names = get().css.variables.map(v => v.name);
        assert.ok(names.every(name => /^--[\w-]+$/.test(name)), names.join(", "));
        assert.strictEqual(get().css.variables.find(v => v.name === "--fixture-gap")?.description, "Gap between items.");
    });

    it("reads named and default slots from the html template", () => {
        const names = get().html.slots.map(s => s.name).sort();
        assert.deepStrictEqual(names, ["icon", null].sort());
    });

    it("reads parts from the html template", () => {
        assert.deepStrictEqual(get().html.parts.map(p => p.name), ["label"]);
    });

    it("reads declared and used css variables from the imported stylesheet", () => {
        const byName = Object.fromEntries(get().css.variables.map(v => [v.name, pick(v, ["declared", "used", "default"])]));
        assert.deepStrictEqual(byName, {
            "--fixture-gap": { declared: true, used: true, default: "4px" },
            "--fixture-color": { declared: false, used: true, default: "red" },
        });
    });
});

describe("analyseFile on @papit/switch", () => {
    const file = repo("web/design-system/atoms/switch/src/component.ts");
    const get = () => analyseFile(file).find(core => core.className === "Switch");

    it("reads the tag name from HTMLElementTagNameMap", () => {
        assert.strictEqual(get().tagName, "pap-switch");
    });

    it("reads checked and defaultChecked with their attributes", () => {
        const attributes = Object.fromEntries(get().properties.map(p => [p.name, p.attribute]));
        assert.deepStrictEqual(attributes, { checked: "checked", defaultChecked: "defaultchecked" });
    });

    it("takes property descriptions from the class JSDoc @property tags", () => {
        const checked = get().properties.find(p => p.name === "checked");
        assert.strictEqual(checked?.description, "Current state of the switch.");
    });

    it("reads the change event dispatched inside a @property callback", () => {
        const change = get().events.find(e => e.name === "change");
        assert.deepStrictEqual(pick(change, ["name", "kind"]), { name: "change", kind: "Event" });
    });

    it("reads the custom states", () => {
        assert.deepStrictEqual([...get().states].sort(), ["active", "checked"]);
    });

    it("leaves out private handlers and lifecycle methods", () => {
        const names = get().methods.map(m => m.name);
        for (const hidden of ["handleclick", "handlekeydown", "handlekeyup", "toggle", "connectedCallback", "formResetCallback", "render"])
        {
            assert.ok(!names.includes(hidden), `${hidden} should not be listed`);
        }
    });
});

describe("analyseFile on plain templates and internal fields", () => {
    const get = () => analyseFile(fixture("plain")).find(core => core.className === "Plain");

    it("reads slots from a plain string returned by render()", () => {
        assert.deepStrictEqual(get().html.slots.map(s => s.name), [null]);
    });

    it("leaves out @query and @translate fields", () => {
        assert.deepStrictEqual(get().properties.map(p => p.name), ["selector"]);
    });

    it("falls back to the type checker for a type it can't read from the source", () => {
        assert.strictEqual(get().properties.find(p => p.name === "selector")?.type, "string");
    });

    it("keeps type parameters in method signatures", () => {
        assert.strictEqual(
            get().methods.find(m => m.name === "pick")?.signature,
            "<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] | null",
        );
    });

    it("types a CustomEvent detail without a generic argument", () => {
        assert.strictEqual(get().events.find(e => e.name === "picked")?.detail, "{ count: number; tag: string; }");
    });
});

describe("analyseFile resolved types", () => {
    const get = () => analyseFile(fixture("resolved")).find(core => core.className === "Resolved");
    const property = (name) => get().properties.find(p => p.name === name);
    /** Union members, sorted: the checker's member order isn't the source order. */
    const members = (type) => type?.split(" | ").sort();

    it("keeps the type as written", () => {
        assert.deepStrictEqual(["color", "mode", "size"].map(name => property(name)?.type), ["Color", "Layout[\"mode\"]", "Size"]);
    });

    it("resolves a local alias", () => {
        assert.deepStrictEqual(members(property("color")?.resolvedType), ["\"primary\"", "\"secondary\""]);
    });

    it("resolves an indexed access type", () => {
        assert.deepStrictEqual(members(property("mode")?.resolvedType), ["\"column\"", "\"row\""]);
    });

    it("resolves an alias imported from another file", () => {
        assert.deepStrictEqual(members(property("size")?.resolvedType), ["\"large\"", "\"small\""]);
    });

    it("leaves resolvedType out when the source already spells the type out", () => {
        assert.ok(!("resolvedType" in property("label")), "label");
        assert.ok(!("resolvedType" in property("items")), "items");
    });

    it("keeps a description that mentions a tag mid-text", () => {
        assert.strictEqual(property("note")?.description, "Plain field without @property: not a prop.");
    });

    it("ends a multi-line description at the first tag that starts a line", () => {
        assert.strictEqual(property("hint")?.description, "Spans two lines,\nand mentions @fires mid-text.");
    });
});
