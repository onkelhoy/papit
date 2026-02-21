
/**
 * stringifyPropertyValue
 * Converts a property value into a string suitable for an attribute.
 */
export function stringify(value: any, type: Function = String) {
    switch (type.name)
    {
        case "String":
        case "Number":
        case "Boolean":
            return String(value);
        case "Element":
            return (value as Element).outerHTML;
        default:
            return JSON.stringify(value);
    }
}
