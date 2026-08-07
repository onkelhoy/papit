import fs from "node:fs";
import path from "node:path";
import { meta } from "@papit/server";
import { Arguments } from "@papit/arguments";
import { Information, LocalPackage, PackageNode } from "@papit/information";
import { copyFolder } from "components/util";
import { getName } from "components/util/name";

type RouterPath = { realpath: string, path: string; } & Record<string, string>;

export async function showcaseRunner(createPackageLocation: string) {
    const {
        importmap
    } = await meta();
    const templateSrc = path.join(createPackageLocation, "asset", "showcase-templates");

    let output = Arguments.string("output");
    if (!(output && fs.existsSync(output)))
    {
        if (Arguments.debug)
            console.log("no output argument provided")

        // if (fs.existsSync(path.join(Information.)))

    }

    const batches = getBatches(["web-component", "game", "theme"]);
    const sidebar = new Map<string, PackageNode<LocalPackage>[]>;
    const paths: RouterPath[] = [];

    for (let batch of batches)
    {
        for (let node of batch)
        {
            // const unscopedname = node.name.split(Information.scope + "/").at(1) ?? "";
            const location = path.relative(path.join(Information.root.location, "packages"), node.location);
            const scope = path.dirname(location);
            // console.log({
            //     scope,
            //     location
            // })
            sidebar.set(scope, (sidebar.get(scope) ?? []).concat([node]));

            const filterviews = Arguments.get("view-filter") ?? ["showcase", "raw", "experiment"]

            try 
            {
                const viewsfolder = path.join(node.location, "views");
                const viewfolders = fs
                    .readdirSync(viewsfolder)
                    .map(name => path.join(viewsfolder, name))
                    .filter(loc => fs.statSync(loc).isDirectory() && fs.existsSync(path.join(loc, "index.html")) && filterviews.includes(path.basename(loc)))
                    .map(loc => path.basename(loc))
                    .sort((a, b) => (filterviews.findIndex(k => k === a) ?? filterviews.length) - (filterviews.findIndex(k => k === b) ?? filterviews.length))


                const first = viewfolders.at(0);
                if (first !== "showcase")
                {
                    if (Arguments.debug)
                        console.log("no showcase view folder, showcase view generated")

                    await generate(node, viewfolders, templateSrc)
                }
                const obj: RouterPath = {
                    realpath: path.join(location, "views/:view"),
                    path: path.join(location, ":view"),
                    view: first ? path.join(location, "views", first) : "",
                };

                for (let i = 1; i < viewfolders.length; i++)
                {
                    obj[`fallback-view${i !== 1 ? i : ""}`] = viewfolders[i];
                }
                paths.push()
            }
            catch (e) { } // deleted folders would cause problems 

            const views: string[] = [];



        }
    }
    // console.log("showcase number", createPackageLocation);
    // console.dir({ importmap: importmap.imports }, { depth: 10 });
}

// helper functions

async function generate(node: PackageNode<LocalPackage>, viewfolders: string[], templateSrc: string) {
    const nameInfo = getName(node.name.replace(Information.scope + "/", "")) ?? { name: node.name, className: node.name };
    let htmlprefix = Arguments.string("html-prefix") ?? node.packageJSON.papit.htmlprefix ?? Information.root.packageJSON.papit.htmlprefix;

    await copyFolder(
        path.join(templateSrc, "individual"),
        path.join(node.location, "views/showcase"),
        file => {

            return file
                .replace(/VARIABLE_NAME/g, node.name)
                .replace(/VARIABLE_HTML_NAME/g, `${htmlprefix}-${nameInfo.name}`)
                .replace(/VARIABLE_CLASS_NAME/g, nameInfo.className)
                // .replace(/VARIABLE_BROWSER_URL/g, "/" + location)
                .replace(/VARIABLE_TABS_TAB/g, "<pap-tab slot=\"tab\" value=\"showcase\">showcase</pap-tab>" + viewfolders.map(view => `<pap-tab slot=\"tab\" value="${view}">${view}</pap-tab>`).join(" "))
                .replace(/VARIABLE_TABS_CONTENT/g, [
                    "<pap-tabpanel value=\"showcase\" path=\":view\" view=\"showcase\" realpath=\"views/:view\"></pap-tabpanel>",
                    viewfolders.map(view => `<pap-tabpanel value="${view}" path=":view" view="${view}" realpath="views/:view"></pap-tabpanel>`).join(" ")
                ].join(" "))
                .replace(/VARIABLE_SELECTED_TAB/g, "showcase")
        }
    );
}

function getBatches(filter: string[]) {
    return Information
        .getPriorityBatches(Arguments.instance, p => p.name.startsWith(Information.scope))
        .map(batch => batch.filter(node => {
            if (node.packageJSON.papit.skip) return false;
            if (typeof node.packageJSON.papit.type === "string")
            {
                if (!filter.includes(node.packageJSON.papit.type)) return false;
            }
            else 
            {
                const _type = node.packageJSON.papit.type as Record<string, string>;
                let ok = false;
                for (let key in _type)
                {
                    if (filter.includes(_type[key]))
                    {
                        ok = true;
                        break;
                    }
                }

                if (!ok) return false;
            }

            return true;
        }));
}