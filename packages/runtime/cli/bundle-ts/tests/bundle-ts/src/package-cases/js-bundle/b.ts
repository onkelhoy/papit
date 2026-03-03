import esbuild, { BuildOptions, BuildResult } from "esbuild";

export type OnBuild = {
    BuildOptions: BuildOptions;
    BuildResultExplicit: esbuild.BuildResult<esbuild.BuildOptions>;
    BuildResult: BuildResult;
};