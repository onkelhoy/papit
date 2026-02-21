import { Arguments } from "@papit/arguments";

export function getAssetFolders() {
    const folders = ["asset", "assets", "public"];

    if (Arguments.has("asset"))
    {
        const asset = Arguments.get("asset");
        folders.push(...asset);
    }
    return folders;
}

