import path from "node:path";

import { Arguments } from "@papit/arguments";
import { Information, PackageGraph } from "@papit/information";
import { Terminal } from "@papit/terminal";

import { runAnalyse } from "components/showcase/analyse";
import { describePackage } from "components/showcase/describe";
import { selectPackages } from "components/showcase/select";
import { writeSite } from "components/showcase/site";
import type { ShowcaseSource } from "components/showcase/types";

/** Comma separated and repeated flag values as one list: `--type=a,b --type=c`. */
function list(key: string) {
    return (Arguments.get(key) ?? []).flatMap(value => value.split(",")).map(value => value.trim()).filter(Boolean);
}

/** `git+https://github.com/acc/repo.git` or `git@github.com:acc/repo.git` → `https://github.com/acc/repo`. */
function repositoryURL(url?: string) {
    if (!url) return undefined;
    return url
        .replace(/^git\+/, "")
        .replace(/^git@([^:]+):/, "https://$1/")
        .replace(/\.git$/, "");
}

export async function showcaseRunner(createPackageLocation: string) {
    const root = Information.root.location;
    const output = path.resolve(root, Arguments.string("output") ?? "showcase");

    const sources = PackageGraph.nodes
        .filter(node => node.name.startsWith(Information.scope + "/"))
        .map(node => node as unknown as ShowcaseSource);

    const selected = selectPackages(root, sources, {
        types: list("type"),
        viewsOnly: Arguments.true("views-only"),
        include: list("include"),
        exclude: list("exclude"),
    });

    if (!Arguments.has("no-analyse"))
    {
        await runAnalyse(selected);
    }

    const workspace = new Set(sources.map(source => source.name));
    const viewFilter = list("view-filter");
    const entries = selected.map(source => describePackage(root, source, workspace, viewFilter));

    const manifest = writeSite({
        root,
        name: Information.scope.replace(/^@/, ""),
        version: Information.root.packageJSON.version,
        repository: repositoryURL(Information.root.packageJSON.repository?.url),
        license: Information.root.packageJSON.license,
        sources: selected,
        entries,
        template: path.join(createPackageLocation, "asset", "showcase-templates", "global"),
        output,
    });

    Terminal.success("showcase:", Terminal.blue(manifest.packages.length), "package(s) →", path.relative(root, output) || ".");
}
