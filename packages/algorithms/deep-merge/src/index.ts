/**
 * Merges objects left to right into a new object; later values win.
 * Nested plain objects merge recursively, everything else (arrays, null, primitives) replaces.
 * Inputs are not mutated, but values taken over unchanged are shared by reference, not cloned.
 *
 * @example deepMerge(defaults, userConfig, overrides)
 */
export function deepMerge<T = any>(...objects: Partial<T>[]): T {
    let output:any = {};

    for (const o of objects)
    {
        output = deepMergeTwo<T>(output, o);
    }

    return output as T;
}

// skipped at every level so untrusted input (e.g. JSON.parse) can't swap or pollute prototypes
const PROTOTYPE_KEYS = ["__proto__", "constructor", "prototype"];

/**
 * Merges `b` into a shallow copy of `a`; see {@link deepMerge} for the rules.
 * @param omit top-level keys of `b` to skip (not applied to nested levels)
 */
export function deepMergeTwo<T = any>(a: Partial<T>, b: Partial<T>, omit: string[] = []): T {
  const result: any = { ...a };

  for (const key in b) {
    if (omit.includes(key) || PROTOTYPE_KEYS.includes(key)) continue;
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
