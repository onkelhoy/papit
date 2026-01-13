import { html as lexer } from "@papit/lexer";
import type Element from "../element/element";

export function Builder(root: Element, html: string) {
  const tokens = lexer(html);

  const stack: Element[] = [root];

  for (const token of tokens)
  {
    const current = stack[stack.length - 1];

    switch (token.type)
    {
      case "text": {
        if (!token.value.trim()) break;
        const node = root.ownerDocument.createTextNode(token.value);
        current.appendChild(node);
        break;
      }

      case "startTag": {

        const el = root.ownerDocument.createElement(token.name);
        for (const key in token.attributes) 
        {
          if (token.attributes[key] === true) el.toggleAttribute(key);
          else el.setAttribute(key, token.attributes[key]);
        }

        current.appendChild(el);

        if (!token.selfClosing)
        {
          stack.push(el);
        }
        break;
      }

      case "comment": {
        const comment = root.ownerDocument.createComment(token.value);
        current.appendChild(comment);
        break;
      }

      case "doctype": {
        root.ownerDocument.doctype = token.value;
        break;
      }

      case "endTag": {
        // Pop until matching tag (simple error recovery)
        for (let i = stack.length - 1; i > 0; i--)
        {
          if (stack[i].tagName === token.name)
          {
            stack.length = i;
            break;
          }
        }
        break;
      }
    }
  }

  return tokens;
}