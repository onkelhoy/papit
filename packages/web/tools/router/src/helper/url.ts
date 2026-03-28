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

export function format(url: string, trailslash: boolean = false) {
    if (!url.startsWith("/")) url = "/" + url;
    if (trailslash) return trailingslash(url);
    return url;
}