export const ParamRegex = /(?<=^:|\/:)([\w-])*/g;

export function extract(url: string): Set<string> {
    const url_params = url.match(ParamRegex);
    const params = new Set<string>();
    if (url_params)
    {
        for (let name of url_params)
        {
            params.add(name);
        }
    }

    return params;
}

export function assign(url: string, params: Record<string, string>) {
    let copy = url;

    for (let name in params)
    {
        let value = getparam_reqursive(name, params);
        if (!value) value = params[name];
        else
        {
            params[name] = value;
        }

        copy = copy.replace(":" + name, value);
    }

    return copy;
}

function getparam_reqursive(param: string, params: Record<string, string>, track = new Set<string>()) {
    if (track.has(param)) return null;
    track.add(param);

    const value = params[param];
    if (!value) return value;
    if (value.startsWith(":"))
    {
        let name = value.slice(1);
        return getparam_reqursive(name, params);
    }

    return value;
}