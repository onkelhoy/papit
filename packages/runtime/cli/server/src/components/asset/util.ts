export function deepMerge<T extends object, U extends object>(a: T, b: U, omit: string[] = []): T & U {
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
      result[key] = deepMerge((result as any)[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
