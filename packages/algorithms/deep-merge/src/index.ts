export function deepMerge<T = any>(...objects: Partial<T>[]): T {
    let output:any = {};

    for (const o of objects)
    {
        output = deepMergeTwo<T>(output, o);
    }

    return output as T;
}

export function deepMergeTwo<T = any>(a: Partial<T>, b: Partial<T>, omit: string[] = []): T {
  const result: any = { ...a };

  for (const key in b) {
    if (omit.includes(key)) continue;
    const value = (b as any)[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (result as any)[key] === "object"
    ) {
      result[key] = deepMergeTwo((result as any)[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
