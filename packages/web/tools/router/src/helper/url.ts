export function trailingslash(url: string) {
    if (!isfileurl(url) && !url.endsWith("/"))
    {
        return url + "/";
    }

    return url;
}

export function isfileurl(url: string) {
    return url.slice(url.lastIndexOf("/")).includes(".");
}

export function basepath(url: string) {
    if (isfileurl(url)) return url.slice(0, url.lastIndexOf("/") + 1); // include the slash
    return url;
}

/**
 * Tidy the url 
 * by having index = -1 tidy will be able to run when called only with tidy(url)
 * @param url string
 * @param index number (passed argument when used in a map)
 * @param array Array<string> (passed argument when used in a map)
 * @returns string
 */
export function tidy(url: string | undefined, index: number = -2, array: string[] = []) {
    if (url === undefined) return "";
    let start = 0;
    let end = url.length;
    if (url.startsWith("/")) start = 1;
    if (url.endsWith("/")) end -= 1;

    url = url.slice(start, end);
    if (index < array.length - 1) return basepath(url);
    return url;
}

export function join(...parts: string[]) {
    return parts.map(tidy).join("/");
}

/**
 * Joins two paths, merging the overlap where the tail of `a`
 * matches the head of `b`, instead of naively concatenating.
 * "/a/b/c" + "b/c/d" -> "/a/b/c/d"
 * "/a/b/c" + "d/e"   -> "/a/b/c/d/e"  (no overlap, falls back to normal join)
 */
export function mergeOverlap(a: string, b: string): string {
    const partsA = tidy(a).split("/").filter(Boolean);
    const partsB = tidy(b).split("/").filter(Boolean);

    const maxOverlap = Math.min(partsA.length, partsB.length);
    let overlap = 0;

    for (let len = maxOverlap; len > 0; len--)
    {
        const tailA = partsA.slice(partsA.length - len).join("/");
        const headB = partsB.slice(0, len).join("/");
        if (tailA === headB)
        {
            overlap = len;
            break;
        }
    }

    return "/" + partsA.concat(partsB.slice(overlap)).join("/");
}

export function format(url: string, trailslash: boolean = false) {

    const filterset = new Set<number>();
    url = url
        .split("/")
        .map((v, index) => {
            if (v === "") filterset.add(index);

            if (v === "..")
            {
                filterset.add(index);

                // should we now also remove the previous 
                if (index > 0) filterset.add(index - 1);
            }

            return v;
        })
        .filter((v, index) => !filterset.has(index))
        .join("/")
        .replace(/\/(\/+)/g, '/');
    // .reduce((p, c, index, array) => {
    //     if (c === "..")
    //     {

    //     }

    //     return p + "/" + c;
    // })

    // url = url.replace(/\.\./g, (substring: string, start: number) => {

    //     if (start === 0) return "";


    //     return "";
    // })

    if (!url.startsWith("/")) url = "/" + url;
    if (trailslash) return trailingslash(url);
    return url;
}