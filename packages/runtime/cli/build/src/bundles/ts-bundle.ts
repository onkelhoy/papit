// import statements 
import path from "node:path";
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { Terminal } from "@papit/terminal";
import { EntryPoint, PackageNode } from "@papit/information";
import { Arguments } from "@papit/arguments";

export async function tsBundler(
    entry: EntryPoint,
    node: PackageNode,
    tempOutDir: string,
    args = Arguments.instance
) {
    let { input, output } = entry.types ?? {};
    if (!input || !output) return "no input or output file";

    input = input.replace(node.location, tempOutDir).replace(/\.ts$/, '.d.ts');

    const result = await Terminal.surpress(async () => {
        // create a config object programmatically
        const extractorConfig = ExtractorConfig.prepare({
            configObject: {
                mainEntryPointFilePath: input,
                projectFolder: node.location,
                compiler: {
                    tsconfigFilePath: node.tsconfigpath,
                },
                dtsRollup: {
                    enabled: true,
                    untrimmedFilePath: output,
                },
            },
            configObjectFullPath: undefined,
            packageJsonFullPath: path.join(node.location, "package.json"),
            // no configObjectFullPath needed if you don’t have a file
        });

        // run API Extractor
        return Extractor.invoke(extractorConfig, {
            localBuild: true,
            showVerboseMessages: !!args.verbose,
        });
    });

    if (!result.succeeded)
    {
        Terminal.error(`API Extractor failed with ${result.errorCount} errors`);
        process.exit(1);
    }
}
