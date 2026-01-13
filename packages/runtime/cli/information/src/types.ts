
type BasePackage = {
    name: string;
    version: string;
    remoteVersion?: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    peerDependencies?: Record<string, string>;
    license?: string;
    repository?: {
        type: "git" | (string & {});
        url: string;
    };

    private?: boolean;
    workspaces?: string[];
    scripts?: Record<string, string>;
    bin?: Record<string, string>;
    main?: string;
    types?: string;
    type: "module" | "commonjs";
    entryPoints?: string | Record<string, string>;
    exports?: string | Partial<Record<"." | (string & {}), string | Partial<Record<"import" | "types" | "require" | (string & {}), string>>>>;
}

export type RootPackage = BasePackage & {
    /**
     * Internal Papit configuration.
     * Used by Papit tooling — avoid manual modification.
     */
    papit: {
        // layers: Record<string, {
        //   name: string;
        //   include: false | "prefix" | "suffix";
        //   /**
        //    * Layer priority (GLOBAL precedence).
        //    *
        //    * This has the strongest effect in the system.
        //    * All packages belonging to this layer are affected by this priority
        //    * before any package-level priority is applied.
        //    *
        //    * Higher priority layers are processed first.
        //    */
        //   priority?: number;
        // }>;
        type?: string;
        htmlprefix?: string;
    };
}

export type LocalPackage = BasePackage & {
    /**
     * Internal Papit configuration.
     * Used by Papit tooling — avoid manual modification.
     */
    papit: {
        /**
         * Package-level priority (LOCAL precedence).
         *
         * Applied after layer priority.
         * Lower numbers are processed first.
         *
         * If omitted, the priority defaults to `Number.MAX_SAFE_INTEGER`
         * (i.e. processed last).
         */
        priority?: number;
        publish: boolean;
        type: string;
        /**
         * Main (default) component.
         * Must match a key in `components`.
         */
        main: string;
        components: Record<string, { className: string, htmlprefix?: string }>;
        htmlprefix?: string;
    };
}

export type Package = RootPackage | LocalPackage;

export type PackageLockEntry = {
    link: boolean;
    resolved: string;
    name?: string;
};
export type Lockfile = {
    name?: string;
    packages: Record<string, PackageLockEntry | Package>;
}

export type RemotePackage = {
    name: string;
    "dist-tags": {
        latest: string;
    };
    versions: Record<string, {
        name: string,
        version: string
    }>;
}

export type RemotePackages = {
    objects: Array<{
        package: {
            name: string;
            version: string;
        },
    }>;
    total: number;
}