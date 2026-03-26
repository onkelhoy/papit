import { Stack } from "@papit/data-structure";
import { css as lexer } from "@papit/lexer";

export function css(content: string, indent: number) {
    const tokens = lexer(content);

    const stack = new Stack<number>();
    const value = tokens.map(token => {
        switch (token.type)
        {
            case "selector":
                return `<div class="block"><span class="variable">${token.value}</span>`;
            case "atRule":
                return `<div class="block"><span class="atrule">${token.value}</span>`;
            case "property":
                return `<div class="block"><span class="property" style="padding-left: ${stack.size}rem;">${token.value}</span>`;
            case "braceOpen":
                stack.push(1);
                return '<span class="symbol"> {</span><div>';
            case "braceClose":
                stack.pop();
                return '</div><span class="symbol">}</span></div>';
            case "colon":
                return '<span class="symbol">:</span>';
            case "semicolon":
                return '<span class="symbol">;</span></div>';
            case "value":
                return `<span class="value"> ${token.value}</span>`;
            case "comment":
                return `<div class="block"><span class="comment">/* ${token.value.trim()} */</span></div>`;
        }
    })

    return `<div class="css" style="padding-left: ${indent}rem">${value.join("")}</div>`;
}