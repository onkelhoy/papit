export enum State {
  Tag,
  Class,
  Attribute,
  Text,
  ID,
  Child,
  Descendant,
  Sibling,
}

export type Token = {
  type: State;
  value: string | null;
};

function getState(char: string) {
  if (char === ".") return State.Class;
  if (char === "[") return State.Attribute;
  if (char === "{") return State.Text;
  if (char === "#") return State.ID;

  return null;
}

export function tokenise(query: string): Token[] {
  let state: State | null = null;
  let buffer = "";
  const tokens: Token[] = [];

  const emit = () => {
    if (state !== null) {
      tokens.push({ type: state, value: buffer || null });
      buffer = "";
      state = null;
    }
  };

  for (let i = 0; i < query.length; i++) {
    const char = query[i];

    // --- combinators ---
    if (char === "+") { emit(); tokens.push({ type: State.Sibling, value: null }); continue; }
    if (char === ">") { emit(); tokens.push({ type: State.Child, value: null }); continue; }
    if (char === " ") {
      emit();
      if (tokens.length === 0) continue;
      const prev = tokens[tokens.length - 1];
      const next = query[i + 1];
      if (next && !/[ \+\>]/.test(next) && ![State.Descendant, State.Child, State.Sibling].includes(prev.type)) 
        tokens.push({ type: State.Descendant, value: null });
      continue;
    }

    const detected = getState(char);
    if (detected !== null && detected !== state) {
      emit();
      state = detected;
      continue;
    }

    if (state === null) state = State.Tag;

    // --- state handling ---
    switch (state) {
      case State.Tag:
      case State.Class:
      case State.ID:
        buffer += char;
        break;

      case State.Attribute:
        if (char === "]") emit();
        else buffer += char;
        break;

      case State.Text:
        if (char === "}") emit();
        else buffer += char;
        break;
    }
  }

  emit();
  return tokens;
}
