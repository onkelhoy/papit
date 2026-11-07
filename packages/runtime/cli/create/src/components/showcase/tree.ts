import type { TreeNode } from "./types";

/**
 * Groups packages into a folder tree by their path (`web/design-system/atoms/button`).
 * Folders come before packages, each sorted by name.
 */
export function buildTree(packages: { name: string; path: string }[]): TreeNode[] {
    const root: TreeNode = { name: "", path: "", children: [] };

    for (const pkg of packages)
    {
        const segments = pkg.path.split("/").filter(Boolean);
        if (segments.length === 0) continue;

        let parent = root;
        for (let i = 0; i < segments.length; i++)
        {
            const name = segments[i];
            let child = parent.children.find(node => node.name === name);
            if (!child)
            {
                child = { name, path: segments.slice(0, i + 1).join("/"), children: [] };
                parent.children.push(child);
            }
            parent = child;
        }
        parent.package = pkg.name;
    }

    sort(root);
    return root.children;
}

function sort(node: TreeNode) {
    node.children.sort((a, b) => {
        const aFolder = a.package ? 1 : 0;
        const bFolder = b.package ? 1 : 0;
        if (aFolder !== bFolder) return aFolder - bFolder;
        return a.name.localeCompare(b.name);
    });
    node.children.forEach(sort);
}
