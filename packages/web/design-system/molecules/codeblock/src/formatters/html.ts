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
                const tag = new Array<string>();
                tag.push(`<div style="padding-left: ${stack.size > 0 ? 2 : 0}rem;"><span class="symbol">&lt;</span>`);
                tag.push(`<span class="name">${token.name}</span>`);

                const attributes = getAttributes(stack.size, token.attributes);
                if (attributes) tag.push(attributes);

                if (token.selfClosing)
                {
                    tag.push(`<span class="symbol">/&gt;</span>`);
                    tag.push("</div>")

                    return tag.join("");
                }

                tag.push(`<span class="symbol">&gt;</span>`);

                stack.push({
                    token,
                    value: tag,
                });
                return tag.join("");
            }

            case "endTag": {
                stack.pop();
                const tag = new Array<string>();
                tag.push('<span class="symbol">&lt;/</span>');
                tag.push(`<span class="name">${token.name}</span>`);
                tag.push('<span class="symbol">&gt;</span></div>');

                return tag.join("");
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

                return `<span class="content" style="white-space: normal">${token.value}</span>`;
            }
        }
    }).join("");

    return `<div class="html">${value}</div>`;
}

function getAttributes(indent: number, attributesRecord: Record<string, string | true>): string | null {
    const value = new Array<string>();
    const attributes = Object.keys(attributesRecord);
    if (attributes.length === 0)
    {
        return null;
    }

    let raw = "";
    attributes.forEach(attr => {
        raw += attr;

        if (attributesRecord[attr] === true || attributesRecord[attr] === "") value.push(`<div><span class="attribute key value">${attr}<span></div>`);
        else 
        {
            raw += "=\"" + attributesRecord[attr] + "\"";
            value.push([
                "<div>",
                `<span class="attribute key">${attr}</span>`,
                '<span class="attribute symbol">=</span>',
                '<span class="attribute symbol">"</span>',
                `<span class="attribute value">${attributesRecord[attr]}</span>`,
                '<span class="attribute symbol">"</span>',
                "</div>"
            ].join(""));
        }
    });

    let style = "";
    if (raw.length > 80) 
    {
        style += "flex-direction: column; padding-left: 2rem;"
    }
    else
    {
        style += "display: inline-flex; gap:0.5rem; margin-left:0.5rem;"
    }

    return `<div style="${style}">${value.join("")}</div>`
}