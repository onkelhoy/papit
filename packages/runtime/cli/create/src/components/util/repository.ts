/**
 * Logo URL (`asset/logo.svg` on `main`) for a repository URL, as used by the template READMEs.
 * GitHub URLs (`git+https://…/acc/repo.git`, `https://…/acc/repo`, `git@github.com:acc/repo.git`)
 * resolve to raw.githubusercontent.com; other hosts fall back to `<repo>/blob/main/asset/logo.svg`.
 */
export function getLogoURL(repository: string) {
    const github = repository.match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?\/?$/);
    if (github) return `https://raw.githubusercontent.com/${github[1]}/${github[2]}/refs/heads/main/asset/logo.svg`;

    const plain = repository.replace(/^git\+/, "").replace(/\.git$/, "").replace(/\/$/, "");
    return `${plain}/blob/main/asset/logo.svg`;
}
