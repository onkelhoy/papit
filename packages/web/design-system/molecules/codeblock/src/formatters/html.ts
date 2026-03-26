import { HtmlToken, html as lexer } from "@papit/lexer";
import { Stack } from "@papit/data-structure";

import { css as formatCSS } from "./css";
import { js as formatJS } from "./js";

export function html(content: string) {
    const tokens = lexer(content);
    const stack = new Stack<{
        token: HtmlToken,
        value: string[],
    }>();

    const value = tokens.map(token => {
        const peek = stack.peek();

        switch (token.type)
        {
            case "startTag": {
                const indent = new Array(stack.size).fill(" ").join("");
                const tag = new Array<string>();
                tag.push(`<div style="padding-left: ${stack.size}rem;"><span class="symbol">&lt;</span>`);
                tag.push(`<span class="name">${token.name}</span>`);

                const [attribs, newlines] = getAttributes(indent, token.attributes);
                if (attribs) tag.push(attribs);

                if (token.selfClosing)
                {
                    if (newlines) tag.push(`<span class="symbol">/&gt;</span>`);
                    else tag.push('<span class="symbol"> /&gt;</span>');

                    tag.push("</div>")

                    return tag.join("");
                }

                if (newlines) tag.push(`<span class="symbol">&gt;</span>`);
                else tag.push('<span class="symbol">&gt;</span>');

                stack.push({
                    token,
                    value: tag,
                });
                return tag.join("");
            }

            case "endTag": {
                const _tag = stack.pop();
                const indent = new Array(stack.size).fill(" ").join("");

                const tag = new Array<string>();
                tag.push('<span class="symbol">&lt;/</span>');
                tag.push(`<span class="name">${token.name}</span>`);
                tag.push('<span class="symbol">&gt;</span></div>');

                // should it be one line ? 
                return indent + tag.join("");
            }

            case "comment": {
                return `<span class="comment"><span class="symbol">&lt;!--</span> ${token.value} <span class="symbol">--&gt;</span></span>`;
            }

            case "doctype": {
                return `<span class="doctype"><span class="symbol">&lt;!</span><span class="name">DOCTYPE</span> ${token.value} <span class="symbol">&gt;</span></span>`;
            }

            case "text": {
                if (peek && peek.token.type === "startTag")
                {
                    const lowerName = peek.token.name.toLowerCase();
                    if (lowerName === "style")
                    {
                        return formatCSS(token.value, stack.size);
                    }

                    if (lowerName === "script")
                    {
                        const scriptType = peek.token.attributes['type'];

                        if (scriptType && scriptType !== true)
                        {
                            if (/text/i.test(scriptType))
                            {
                                return `<span class="content">${token.value}</span>`;
                            }
                        }

                        return formatJS(token.value, stack.size);
                    }
                }

                return `<span class="content">${token.value}</span>`;
            }
        }
    }).join("");

    return `<div class="html">${value}</div>`;
}

function getAttributes(indent: string, attributesRecord: Record<string, string | true>): [string, boolean] {
    const value = new Array<string>();
    const attributes = Object.keys(attributesRecord);
    if (attributes.length === 0)
    {
        return ["", false];
    }


    // value.push().join(" "));
    attributes.forEach(attr => {
        if (attributesRecord[attr] === true) value.push(`<span class="attribute key">${attr}<span>`);
        else value.push(`<span class="attribute key">${attr}</div>="<span class="attribute value">${attributesRecord[attr]}</span>"`)
    });

    const combined = value.join(" ");
    if (combined.length > 150) 
    {
        return ["\n" + indent + value.join("\n" + indent), true]
    }
    return [combined, false];
}