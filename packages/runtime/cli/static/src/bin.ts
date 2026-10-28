import path from "node:path";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { PackageGraph } from "@papit/information";

import { build } from "./components/static";

(async function () {
    const cwd = process.cwd();

    // @papit/information reads the package from PWD; an npm prefix from another workspace
    // would point the graph at the wrong root
    process.env.PWD = cwd;
    const prefix = process.env.npm_config_local_prefix;
    if (prefix && path.relative(prefix, cwd).startsWith(".."))
    {
        delete process.env.npm_config_local_prefix;
        PackageGraph.initialize();
    }

    try
    {
        const output = Arguments.string("output") ?? "dist";
        const result = await build({ cwd, target: Arguments.string("target"), output, base: Arguments.string("base") });

        if (Arguments.info)
        {
            Terminal.write(
                "static:", path.relative(cwd, result.folder) || ".", "→", path.resolve(cwd, output), "-",
                Terminal.blue(result.pages.length), "page(s),",
                Terminal.blue(result.assets), "asset(s),",
                Terminal.blue(result.translations), "language(s),",
                Terminal.blue(result.dependencies), "lib folder(s)",
            );
        }
    }
    catch (error)
    {
        Terminal.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}());
