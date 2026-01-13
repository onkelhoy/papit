import { Token, State } from "./token";

export type Query = {
  tag?: string;
  class?: string[];
  attribute?: { name: string, value: string|true };
  id?: string;
  text?: string;
  relation?: "descendant"|"child"|"sibling";
}

export function parser(tokens: Token[]): Query[] {
  const result: Query[] = [];

  let current: Query | null = null;
  let last: Query | null = null;
  let pendingCombinator: State | null = null;

  const commit = () => {
    if (!current) return;

    // if (pendingCombinator && last) {
    //   if (pendingCombinator === State.Child) last.child = current;
    //   if (pendingCombinator === State.Sibling) last.sibling = current;
    //   // Descendant handled later if you want recursion
    // } else {
    // }
    result.push(current);

    last = current;
    current = null;
    pendingCombinator = null;
  };

  for (const token of tokens) {
    switch (token.type) {
      case State.Tag:
        current ??= {};
        current.tag = token.value!;
        break;

      case State.ID:
        current ??= {};
        current.id = token.value!;
        break;

      case State.Class:
        current ??= {};
        current.class = token.value!.split(".");
        break;

      case State.Text:
        current ??= {};
        current.text = token.value!;
        break;

      case State.Attribute: {
        current ??= {};
        const [name, value] = token.value!.split("=");
        current.attribute = {
          name,
          value: value?.replace(/"/g, "") ?? true,
        };
        break;
      }

      case State.Child:
        if (current) current.relation = "child";
        commit();
        break;
      case State.Sibling:
        if (current) current.relation = "sibling";
        commit();
        break;
      case State.Descendant:  
        if (current) current.relation = "descendant";
        commit();
        break;
    }
  }

  commit();
  return result;
}
