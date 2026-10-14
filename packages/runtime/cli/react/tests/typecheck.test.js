import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { writeReact } from "@papit/react";

import { fixturePackage, linkReactTypes, repo, tmp, typecheck, write } from "./helpers.js";

describe("generated react-wrapper.tsx typechecks against @types/react", () => {
    let root;

    before(() => {
        root = tmp();
        fixturePackage(root);
        linkReactTypes(root);
        writeReact(root);
        write(root, {
            "src/usage.tsx": [
                `import { useRef } from "react";`,
                `import type { Fixture as FixtureElement } from "@tmp/fixture";`,
                `import { Fixture, FixtureDialog, FixtureDrawer, FixtureItem, type FixtureDialogProps, type FixtureProps } from "./react-wrapper";`,
                ``,
                `export function App() {`,
                `    const ref = useRef<FixtureElement>(null);`,
                `    return (`,
                `        <Fixture`,
                `            ref={ref}`,
                `            label="hi"`,
                `            open`,
                `            disabled={false}`,
                `            variant="large"`,
                `            items={[{ id: 1 }]}`,
                `            count={2}`,
                `            tone="warn"`,
                `            when={new Date()}`,
                `            id="a"`,
                `            className="x"`,
                `            onChange={(event) => { event.type; }}`,
                `            onValueChange={(event) => { event.detail.value.toUpperCase(); }}`,
                `            onTabSelect={(event) => { event.detail; }}`,
                `        >`,
                `            <FixtureItem value="1" ref={(node) => { node?.value; }} />`,
                `        </Fixture>`,
                `    );`,
                `}`,
                ``,
                `// the raw tags are typed too, through the JSX intrinsic elements`,
                `export function Raw() {`,
                `    const ref = useRef<FixtureElement>(null);`,
                `    return (`,
                `        <fixture-el ref={ref} open variant="small" label-text="hi" tone="info" click id="b">`,
                `            <fixture-item value="2" />`,
                `        </fixture-el>`,
                `    );`,
                `}`,
                ``,
                `// protected props, by their attribute name, and overrides of inherited ones`,
                `export function Dialogs() {`,
                `    return (`,
                `        <>`,
                `            <FixtureDialog closeoutsideclick modal={false} loop={false} header="a" />`,
                `            <FixtureDrawer closeoutsideclick={false} modal loop header="b" />`,
                `            <fixture-dialog close-outside-click modal="false" loop="false" suppressHydrationWarning />`,
                `            <fixture-drawer close-outside-click="false" header="c" />`,
                `        </>`,
                `    );`,
                `}`,
                ``,
                `// @ts-expect-error ismodal is protected, it's the modal prop`,
                `export const protectedName: FixtureDialogProps = { ismodal: true };`,
                `// @ts-expect-error modal is a boolean`,
                `export const protectedType: FixtureDialogProps = { modal: "yes" };`,
                `// @ts-expect-error only a default-true boolean takes the string "false" on the raw tag`,
                `export const rawFalseString = <fixture-el open="false" />;`,
                `// @ts-expect-error label is a string`,
                `export const wrongType: FixtureProps = { label: 1 };`,
                `// @ts-expect-error internal is not a @property`,
                `export const notAProp: FixtureProps = { internal: 1 };`,
                `// @ts-expect-error size is readonly`,
                `export const readonlyProp: FixtureProps = { size: 2 };`,
                `// @ts-expect-error open is a boolean on the raw tag as well`,
                `export const rawWrongType = <fixture-el open="yes" />;`,
                `// @ts-expect-error the raw tag takes label under its attribute name, label-text`,
                `export const rawRenamed = <fixture-el label="hi" />;`,
                `// @ts-expect-error the raw tag takes withClick under its attribute name, click`,
                `export const rawRenamedPlain = <fixture-el withClick />;`,
                `// @ts-expect-error click is typed from the element's withClick, a boolean`,
                `export const rawRenamedType = <fixture-el click="yes" />;`,
                `// @ts-expect-error label-text is typed from the element's label, a string`,
                `export const rawHyphenType = <fixture-el label-text={1} />;`,
                `// @ts-expect-error object props aren't passed to the raw tag, they would become attributes`,
                `export const rawObject = <fixture-el items={[]} />;`,
                `// @ts-expect-error a Date can't be an attribute, so when isn't passed to the raw tag either`,
                `export const rawDate = <fixture-el when={new Date()} />;`,
            ].join("\n"),
        });
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    // baseUrl "src" as in every web package: a bare `react` import must not resolve to the generated file
    it("the fixture's react-wrapper.tsx and a usage of it compile with no errors under baseUrl src", () => {
        const diagnostics = typecheck(
            [path.join(root, "src/react-wrapper.tsx"), path.join(root, "src/usage.tsx")],
            {},
            { baseUrl: path.join(root, "src"), paths: { "@tmp/fixture": ["./index.ts"] } },
        );
        assert.deepStrictEqual(diagnostics, []);
    });
});

for (const [name, folder, components] of [
    ["@papit/tabs", "web/design-system/atoms/tabs", ["Tabs", "Tab", "TabPanel"]],
    ["@papit/switch", "web/design-system/atoms/switch", ["Switch"]],
])
{
    describe(`papit-react on ${name}`, () => {
        const location = repo(folder);
        let root;
        let output;
        let result;
        let committed;
        // the package's own wrapper, committed as .ts or .tsx, must be left as it is
        const own = ["src/react-wrapper.ts", "src/react-wrapper.tsx"].map(file => path.join(location, file));
        const snapshot = () => own.map(file => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined);

        before(() => {
            committed = snapshot();
            root = tmp();
            output = path.join(root, "react-wrapper.tsx");
            result = writeReact(location, { output });
        });
        after(() => fs.rmSync(root, { recursive: true, force: true }));

        it("writes to the given output only", () => {
            assert.deepStrictEqual(result, { file: output, status: "written" });
            assert.deepStrictEqual(snapshot(), committed);
        });

        it("exports a component per element, importing the package by name", () => {
            const code = fs.readFileSync(output, "utf8");
            assert.deepStrictEqual([...code.matchAll(/^export function (\w+)\(/gm)].map(m => m[1]), components);
            assert.match(code, new RegExp(`^    void import\\("${name}"\\);$`, "m"));
            assert.doesNotMatch(code, new RegExp(`^import "${name}";$`, "m"));
        });

        it("typechecks against the package's built types", () => {
            assert.deepStrictEqual(typecheck([output], { [name]: [path.join(location, "lib/bundle.d.ts")] }), []);
        });
    });
}
