import { LocalPackage } from "@papit/util"

export type Meta = {
  entryPoints: {
    record: Record<string, string>;
    keys: string[];
  };
  externals: string[];
  lastModified?: number;
  tsconfig: {
    info: {
      declaration: boolean;
      outDir: string;
      srcFolder: string;
    };
    path: string;
  };
  config: LocalPackage['papit'];
}