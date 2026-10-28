/** Options for `build`. */
export type StaticOptions = {
    /** Folder the command runs in; `target` and `output` resolve against it. @default process.cwd() */
    cwd?: string;
    /** Page folder: `<cwd>/<target>`, else `<cwd>/views/<target>`. Without it, see `resolveTarget`. */
    target?: string;
    /** Folder the site is written to. Must not be, or contain, the page folder. @default "dist" */
    output?: string;
    /** URL prefix of every generated URL, e.g. `/papit/` for a GitHub project page. @default "/" */
    base?: string;
};

/** What `build` wrote. */
export type StaticResult = {
    /** The page folder that was published. */
    folder: string;
    /** Page paths relative to the output folder. */
    pages: string[];
    /** Asset files written under `public/` from workspace packages. */
    assets: number;
    /** Language files written under `public/translations/`. */
    translations: number;
    /** Package folders copied under `lib/`. */
    dependencies: number;
};
