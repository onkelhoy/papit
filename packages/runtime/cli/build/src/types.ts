import type { BuildOptions, BuildResult } from "esbuild";

export type ExecutorOptions = {
  callback(counter: number, result: BuildResult<BuildOptions>): void;
  watch: boolean;
}