/** The slice of a workspace package the showcase generator reads. */
export type ShowcaseSource = {
    name: string;
    /** Absolute folder of the package. */
    location: string;
    packageJSON: {
        version?: string;
        description?: string;
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        papit?: { type?: string | Record<string, string>; skip?: boolean };
    };
};

/** Which packages end up in the showcase. */
export type SelectOptions = {
    /** Keep only these `papit.type`s. Empty keeps every type. */
    types?: string[];
    /** Skip packages without a `views/` folder. */
    viewsOnly?: boolean;
    /** Path globs relative to `packages/`; a package must match one. Empty keeps all. */
    include?: string[];
    /** Path globs relative to `packages/`; a matching package is dropped. */
    exclude?: string[];
};

/** A folder (group) or package (leaf) in the sidebar tree. */
export type TreeNode = {
    /** Folder or package folder name. */
    name: string;
    /** Path relative to `packages/`, used as the route. */
    path: string;
    /** Package name, only on leaves. */
    package?: string;
    children: TreeNode[];
};

/** Everything the showcase page knows about one package. */
export type ShowcaseEntry = {
    name: string;
    version: string;
    description: string;
    type: string[];
    /** Path relative to `packages/`; also the folder in the site output. */
    path: string;
    /** View folder names, ordered by the view filter. */
    views: string[];
    readme: boolean;
    analyse: boolean;
    /** Files under `asset/`, relative to it. */
    assets: string[];
    /** Language ids from `asset/translations/*.json`. */
    translations: string[];
    /** Workspace package names this package depends on. */
    dependencies: string[];
};

/** The `manifest.json` written next to the site's index.html. */
export type ShowcaseManifest = {
    name: string;
    version: string;
    /** Repository web URL, e.g. `https://github.com/acc/repo`. */
    repository?: string;
    license?: string;
    readme: boolean;
    tree: TreeNode[];
    packages: ShowcaseEntry[];
};
