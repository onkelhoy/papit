import { tokenise } from "./token";
import { parser, Query } from "./parser";

const cachedQueries:Record<string, Query[]> = {};
export function Query(query: string) {
  if (cachedQueries[query]) return cachedQueries[query];

  const tokens = tokenise(query);
  const parsed = parser(tokens);

  cachedQueries[query] = parsed;
  return parsed;
}