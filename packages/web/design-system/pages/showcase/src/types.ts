/** A folder (group) or package (leaf) in the sidebar tree. */
export type ShowcaseTreeNode = {
    name: string;
    /** Path relative to `packages/`, also the route. */
    path: string;
    /** Package name on package leaves; the markdown file on doc leaves. */
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
    /** Repository web URL, shown in the footer. */
    repository?: string;
    license?: string;
    readme: boolean;
    /** The docs folder's markdown files as a tree; leaf `package` is the file. */
    docs?: ShowcaseTreeNode[];
    tree: ShowcaseTreeNode[];
    packages: ShowcaseEntry[];
};

/** Where the hash points: home, a package page, or one of its views. */
export type ShowcaseRoute = {
    /** The package, absent on the home page or an unknown path. */
    entry?: ShowcaseEntry;
    /** View folder or auto page name; absent means the package README. */
    page?: string;
    /** A documentation file (relative to `docs/`) when the hash is `#/docs/<path>`. */
    doc?: string;
    /** The hash path that didn't match any package. */
    unknown?: string;
};
