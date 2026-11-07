/** A folder (group) or package (leaf) in the sidebar tree. */
export type ShowcaseTreeNode = {
    name: string;
    /** Path relative to `packages/`, also the route. */
    path: string;
    /** Package name, only on leaves. */
    package?: string;
    children: ShowcaseTreeNode[];
};

/** One package in the manifest. */
export type ShowcaseEntry = {
    name: string;
    version: string;
    description: string;
    type: string[];
    /** Path relative to `packages/`; also its folder in the site. */
    path: string;
    /** View folder names, `showcase` first. */
    views: string[];
    readme: boolean;
    analyse: boolean;
    assets: string[];
    translations: string[];
    dependencies: string[];
};

/** The `manifest.json` written by `npm create @papit -- --showcase`. */
export type ShowcaseManifest = {
    name: string;
    version: string;
    readme: boolean;
    tree: ShowcaseTreeNode[];
    packages: ShowcaseEntry[];
};

/** Where the hash points: home, a package page, or one of its views. */
export type ShowcaseRoute = {
    /** The package, absent on the home page or an unknown path. */
    entry?: ShowcaseEntry;
    /** View folder or auto page name; absent means the package README. */
    page?: string;
    /** The hash path that didn't match any package. */
    unknown?: string;
};
