import { Arguments } from "@papit/arguments";
import { Information, PackageGraph } from "@papit/information";
import { Terminal } from "@papit/terminal";
import fs from "node:fs";
import path from "node:path";

export function getFolders(dir: string): string[] {
    return fs.readdirSync(dir).filter(name => fs.statSync(path.join(dir, name)).isDirectory());
};

function getLayerFolders(
    dir: string,
): string[] {
    return fs
        .readdirSync(dir)
        .filter(name => {
            const joined = path.join(dir, name);
            if (!fs.statSync(joined).isDirectory()) return false;
            if (PackageGraph.search(joined)) return false;

            return true;
        });
};

export async function selectFolder() {
    return Terminal.sessionBlock(async () => {
        let target = path.join(Information.root.location, "packages");
        const original = target;

        while (target)
        {
            const session = Terminal.createSession();
            const folders = getLayerFolders(target);

            Terminal.write("Current: ", target.replace(Information.root.location, Information.scope));
            Terminal.write();

            const option = await Terminal.option([["Choose Folder", "Create Folder"], target === original ? folders : ["..", ...folders]]);

            if (option.index === 0)
            {
                break;
            }
            if (option.index === 1)
            {
                const answer = await Terminal.prompt("folder name", false, target);

                const url = path.join(target, answer.input);
                const created = await createFolder(url);

                if (created)
                {
                    target = path.join(target, answer.input);
                }
            }
            else if (option.index === 2 && target !== original)
            {
                target = path.resolve(target, "..");
            }
            else 
            {
                target = path.join(target, folders[option.index - (target === original ? 2 : 3)]);
            }
            Terminal.clearSession(session);
        }

        return target;
    });
}


async function createFolder(
    url: string,
) {
    Terminal.createSession();
    Terminal.write(`[${url}]`);
    const shouldCreate = Arguments.has("agree") || await Terminal.confirm("confirm folder creation", true);

    if (!shouldCreate) return false;

    fs.mkdirSync(url, { recursive: true, });

    Terminal.clearSession();

    return true;
}

/**
 * Recursively copy a folder to a destination.
 * Optionally, post-process files with a parser function.
 *
 * @param {string} src - Source folder path
 * @param {string} dest - Destination folder path
 * @param {(content: string, src: string, destination: string) => false | string | Promise<string|false>} [parser] - Optional function to transform file content, use false to filter out
 */
export async function copyFolder(src: string, dest: string, parser: (content: string, src: string, destination: string) => false | string | Promise<string | false>) {
    // Ensure destination exists
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries)
    {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory())
        {
            await copyFolder(srcPath, destPath, parser); // recursive copy
            continue;
        }

        // case file 
        if (typeof parser !== "function")
        {
            fs.copyFileSync(srcPath, destPath);
            continue;
        }

        const content = fs.readFileSync(srcPath, "utf-8");
        const parsed = await parser(content, srcPath, destPath);
        if (parsed === false) continue;

        fs.copyFileSync(srcPath, destPath);
        fs.writeFileSync(destPath, parsed, "utf-8");
    }
}
