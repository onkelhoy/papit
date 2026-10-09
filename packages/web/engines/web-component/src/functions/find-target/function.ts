import { nextParent } from "functions/next-parent";

export function findTarget(
    element: HTMLElement,
    query: string | (() => string) | undefined,
    finder?: (target: HTMLElement) => HTMLElement | null,
): HTMLElement | null {
    let target: HTMLElement | null = element;

    const queryvalue = query ? typeof query === "function" ? query.call(target) : query : null;
    let matches: Node[] = [];
    if (queryvalue)
    {
        const root = element.getRootNode();
        if (root instanceof Document || root instanceof HTMLElement || root instanceof ShadowRoot)
        {
            matches = [...root.querySelectorAll(queryvalue)]; // perhaps this is heavyu 
            if (matches.length === 1) // DIRECT MATCH 
            {
                target = (matches[0] as HTMLElement) ?? null;
                return target;
            }
        }
    }

    const _finder: typeof finder = queryvalue && !finder ? ((t: HTMLElement) => t.matches(queryvalue) ? t : null) : finder;
    if (!_finder) return null;

    target = nextParent(element);
    while (target)
    {
        const find = _finder(target);
        if (find) 
        {
            return find;
        }

        if (target === document.documentElement)
        {
            return null;
        }

        target = nextParent(target);
    }

    return target;
}