/**
 * Deep equality check with recursion limit.
 *
 * @throws If recursion exceeds `maxReqursiveSteps`.
 */
export function same(a:any, b:any, maxReqursiveSteps = 20, reqursiveSteps = 0) {
  if (reqursiveSteps > maxReqursiveSteps) 
  {
    console.trace({a, b, maxReqursiveSteps});
    throw new Error("[decorator] value is exciding the maxReqursiveSteps");
  }

  if (typeof a !== typeof b) return false;
  switch (typeof a) 
  {
    case "string":
    case "number":
    case "boolean":
      return a === b;
    
    case "object": 
    {
      if (Array.isArray(a))
      {
        if (!Array.isArray(b)) return false;

        if (a.length !== b.length) return false;
        if (a.some((v, i) => !same(v, b[i], maxReqursiveSteps, reqursiveSteps + 1))) return false;
        return true;
      }

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;
      for (let i=0; i<keysA.length; i++)
      {
        if (keysA[i] !== keysB[i]) return false;
        if (!same(a[keysA[i]], b[keysB[i]], maxReqursiveSteps, reqursiveSteps + 1)) return false;
      }

      return true;
    }
    default:
      if (a !== undefined)
      {
        console.warn("[decorator]: unsopprted type detected", typeof a, typeof b, a, b);
      }
      return a === b;
  }
}