/**
 * parseAttributeValue
 * Converts an attribute string value into the appropriate type.
 */
export function parse(value:string|null|undefined, type: Function = String) {
  if (value === null || value === undefined) return value;

  switch (type.name)
  {
    case "String":
      return String(value);
    case "Number":
      return Number(value);
    case "Boolean": {
      if (/(false|f|0)/i.test(value)) return false;
      return true; 
    }
    default: {
      // could enhance with allowing Elements to be but I think at that point bigger issues would exists 
      if (/(element|node)$/i.test(type.name))
      {
        throw new Error("[error]: cannot handle elements as properties");
      }

      return JSON.parse(value);
    }
  }
}