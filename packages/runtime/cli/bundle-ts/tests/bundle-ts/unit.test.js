import fs from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

import { tsBundle } from "@papit/bundle-ts";

describe.skip('@papit/bundle-ts', () => {
    beforeEach(() => {
        fs.rmSync(path.join(import.meta.dirname, "out"), { recursive: true, force: true });
        fs.rmSync(path.join(import.meta.dirname, ".temp"), { recursive: true, force: true });
    });

    describe("bundle raw", () => {
        it("should bundle a type", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/raw/type.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content, 'export type Lala = "hej" | "san";\n');
        });

        it("should bundle a class", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/raw/class.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'export declare class Alright {\n' +
                '    property: string;\n' +
                '    get something(): string;\n' +
                '    method(): string;\n' +
                '    private pmethod;\n' +
                '}\n'
            );
        });

        it("should bundle a function", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/raw/function.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content, 'export declare function hello(): string;\n');
        });

        it("should bundle empty files with export only", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/empty.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content, 'export { };\n');
        });
    });

    describe("singular", () => {

        it('should bundle with external import + monorepo package', async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/external.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'import ts from "typescript";\n' +
                'import { jsBundle } from "@papit/bundle-js";\n' +
                '\n' +
                'type D = {\n' +
                '    banana: number;\n' +
                '};\n' +
                'type DType = "world" | number | D;\n' +
                'type B = number | boolean;\n' +
                '\n' +
                'export declare function hello(node: ts.Node, something: ReturnType<typeof jsBundle>): void;\n' +
                'export declare const A: DType;\n' +
                'export type A = string | B;\n'
            );
        });

        it('should bundle with singular entrypoint', async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/a.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'type D = {\n' +
                '    banana: number;\n' +
                '};\n' +
                'type DType = "world" | number | D;\n' +
                'type CType = "hello" | DType;\n' +
                '\n' +
                'export declare function B(): string;\n' +
                'export declare function A(input: CType): DType;\n'
            );
        });
    });

    describe("multi entries", () => {
        it("should handle multiple entry points", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/multi/a.ts"),
                            output: path.join(import.meta.dirname, "out/a.d.ts"),
                        },
                        {
                            input: path.join(import.meta.dirname, "src/multi/b.ts"),
                            output: path.join(import.meta.dirname, "out/b.d.ts"),
                        }
                    ]
                }
            );

            assert.ok(fs.existsSync(path.join(import.meta.dirname, "out/types.d.ts")), "no common types file");
            assert.ok(fs.existsSync(path.join(import.meta.dirname, "out/a.d.ts")), "no a file");
            assert.ok(fs.existsSync(path.join(import.meta.dirname, "out/b.d.ts")), "no b file");
        });
    });

    describe("reexport", () => {
        describe("simple cases", () => {

            it('should bundle with local', async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/local.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content,
                    'type D = {\n' +
                    '    banana: number;\n' +
                    '};\n' +
                    '\n' +
                    'export type DType = "world" | number | D;\n'
                );
            });

            it('should bundle with multiple', async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/multiple.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content,
                    'type D = {\n' +
                    '    banana: number;\n' +
                    '};\n' +
                    'type DType = "world" | number | D;\n' +
                    'type CType = "hello" | DType;\n' +
                    '\n' +
                    'export declare function B(): string;\n' +
                    'export declare function A(input: CType): DType;\n'
                );
            });

            it('should bundle with external', async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/external.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content,
                    'export { default as ts } from "typescript";\n'
                );
            });

            it('should bundle export as', async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/as.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content,
                    'type D = {\n' +
                    '    banana: number;\n' +
                    '};\n' +
                    'type DType = "world" | number | D;\n' +
                    '\n' +
                    'export type Hello = DType;\n'
                );
            });

            it('should bundle export as + original', async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/as-plus.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content,
                    'type D = {\n' +
                    '    banana: number;\n' +
                    '};\n' +
                    '\n' +
                    'export type Hello = DType;\n' +
                    'export type DType = "world" | number | D;\n'
                );
            });
        });

        describe("star exports", () => {

            it("should handle export-clause", async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/star.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content,
                    'export declare function B(): string;\n' +
                    'export type Hello = "world";\n'
                );
            });

            it("should handle star export of externals", async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/star-external.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content, 'export * from "@papit/bundle-js";\n');
            });

            it.skip("should handle star-as (TODO: requires namespace generation)", async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/star-as.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                console.log({ content })
                assert.strictEqual(content, 'export * from "@papit/bundle-js";\n');
            });

            it.skip("should handle star-nested", async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/star-nested.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                console.log({ content })
                assert.strictEqual(content, 'export * from "@papit/bundle-js";\n');
            });

            it.skip("should handle star-nested-as", async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/star-nested-as.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                console.log({ content })
                assert.strictEqual(content, 'export * from "@papit/bundle-js";\n');
            });
        });

        describe("import-export", () => {
            it("should handle import-export", async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/import-export.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content,
                    'type D = {\n' +
                    '    banana: number;\n' +
                    '};\n' +
                    'type DType = "world" | number | D;\n' +
                    'type CType = "hello" | DType;\n' +
                    '\n' +
                    'export declare function B(): string;\n' +
                    'export declare function A(input: CType): DType;\n'
                );
            });

            it("should handle import-export-as", async () => {
                await tsBundle(
                    new Set(),
                    import.meta.dirname,
                    {
                        entryPointsArray: [
                            {
                                input: path.join(import.meta.dirname, "src/reexport/import-export-as.ts"),
                                output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                            }
                        ]
                    }
                );

                assert.ok(fs.existsSync(path.join(import.meta.dirname, "out")), "out folder was not generated");

                const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
                assert.strictEqual(content,
                    'type D = {\n' +
                    '    banana: number;\n' +
                    '};\n' +
                    'type DType = "world" | number | D;\n' +
                    'type CType = "hello" | DType;\n' +
                    '\n' +
                    'export declare function C(): string;\n' +
                    'export declare function A(input: CType): DType;\n'
                );
            });
        })
    });

    describe("default exports", () => {
        it("should deal with default export for class", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/default/class.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'export default class CLASS {\n}\n'
            );
        });

        it("should deal with default export for function", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/default/function.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'export default function FUNCTION(): string;\n'
            );
        });

        it("should deal with default export for type", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/default/type.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'type TYPE = "BAJS";\n\nexport default TYPE;\n'
            );
        });

        it("should deal with default export for const", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/default/const.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'declare const CONST = true;\n\nexport default CONST;\n'
            );
        });

        it("should deal with default export with import-export", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/default/import-export.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'export class iCLASS {\n' +
                '}\n' +
                'export declare const iCONST = true;\n' +
                'export function iFUNCTION(): string;\n' +
                'export type iTYPE = "BAJS";\n'
            );
        });

        it("should deal with default reexport", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/default/reexport.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'export class iCLASS {\n' +
                '}\n' +
                'export declare const iCONST = true;\n' +
                'export function iFUNCTION(): string;\n' +
                'export type iTYPE = "BAJS";\n'
            );
        });
    });

    describe("package edge cases", () => {
        it('should handle bundle-js case', async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/package-cases/js-bundle/entry.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'import esbuild, { BuildOptions, BuildResult } from "esbuild";\n' +
                '\n' +
                'export type OnBuild = {\n' +
                '    BuildOptions: BuildOptions;\n' +
                '    BuildResultExplicit: esbuild.BuildResult<esbuild.BuildOptions>;\n' +
                '    BuildResult: BuildResult;\n' +
                '};\n' +
                'export type a = BuildOptions;\n'
            );
        });

        // TODO NOT WORKING 
        it('should handle html case', async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/package-cases/html/index.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            assert.strictEqual(content,
                'export type D = true;\n' +
                'export type C = true;\n' +
                'export type B = true;\n' +
                'export type A = true;\n'
            );
        });

        it.only("should handle web-component case", async () => {
            await tsBundle(
                new Set(),
                import.meta.dirname,
                {
                    entryPointsArray: [
                        {
                            input: path.join(import.meta.dirname, "src/package-cases/web-components/index.ts"),
                            output: path.join(import.meta.dirname, "out/bundle.d.ts"),
                        }
                    ]
                }
            );

            const content = fs.readFileSync(path.join(import.meta.dirname, "out/bundle.d.ts"), { encoding: "utf-8" });
            console.log({ content })
            assert.strictEqual(content,
                'type Settings = {\n' +
                '    yes: "no";\n' +
                '};\n' +
                'type Settings2 = {\n' +
                '    blabal: "no";\n' +
                '};\n' +
                '\n' +
                'export type SomethingElse = Settings;\n' +
                'export type SomethingElse2 = Settings2;\n' +
                'export declare function property(settings: Settings): "no";\n' +
                'export declare function property2(settings: Settings2): "no";\n'
            );
        })
    })
});