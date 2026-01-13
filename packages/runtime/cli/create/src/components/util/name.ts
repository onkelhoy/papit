export function getName(name: string)
{
    if (!name) return undefined;

    const split = name.split(/[ |-]/);
    const safe = split.join("-");

    return {
        className: capitalize(split.map(capitalize).join("")),
        name: safe.toLowerCase(),
    }
}

function capitalize(str: string)
{
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}
