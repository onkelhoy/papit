// import statements 
import path from "node:path";
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { Arguments, Terminal, copyFolder, getPathInfo } from "@papit/util";

import { Meta } from "../meta/types";

export async function tsBundler(
  inputFile: string,
  outputFile: string,
  meta: Meta,
  info: ReturnType<typeof getPathInfo>,
) {
  if (!meta.tsconfig.info.declaration) return;

  // * <- was here

  const outDir = path.join(info.local, ".temp/build");
  await Terminal.execute(
    "tsc",
    info.local,
    ["--emitDeclarationOnly", "-p", meta.tsconfig.path, "--declarationDir", outDir],
  );

  const result = await Terminal.surpress(async () => {
    // create a config object programmatically
    const extractorConfig = ExtractorConfig.prepare({
      configObject: {
        mainEntryPointFilePath: inputFile,
        projectFolder: info.local,
        compiler: {
          tsconfigFilePath: meta.tsconfig.path,
        },
        dtsRollup: {
          enabled: true,
          untrimmedFilePath: outputFile,
        },
      },
      configObjectFullPath: undefined,
      packageJsonFullPath: path.join(info.local, "package.json"),
      // no configObjectFullPath needed if you don’t have a file
    });

    // run API Extractor
    return Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: !!Arguments.verbose,
    });
  });
  
  if (!result.succeeded)
  {
    Terminal.error(`API Extractor failed with ${result.errorCount} errors`);
    process.exit(1);
  }
}

// * this
//   if (Arguments.args.flags.dev)
//   {
//     const srcName = path.basename(path.dirname(inputFile));
//     const outDir = path.dirname(outputFile);

//     await Terminal.execute(
//       "tsc",
//       info.local,
//       ["--emitDeclarationOnly", "-p", meta.tsconfig.path, "--declarationDir", outDir],
//     );

//     // The srcName folder that gets created INSIDE outDir (not in package root)
//     const tempDtsDir = path.join(outDir, srcName);

//     if (fs.existsSync(tempDtsDir))
//     {
//       // Copy the generated .d.ts files from the nested folder to outDir
//       await copyFolder(tempDtsDir, outDir, content => content);
//       // Delete the temporary nested folder
//       fs.rmSync(tempDtsDir, { recursive: true, force: true });
//     }

//     return;
//   }