// core
import { translator } from '@papit/translator';
import "@papit/codeblock";

// component
import '@papit/markdown';

const SAMPLE = `# Markdown preview

Write **bold**, *italic*, ~~struck~~ and \`inline code\`. Links: [papit](https://github.com/onkelhoy/papit), <https://example.com> or a bare https://example.com.

## Lists

1. ordered
2. lists
   - nested
   - [x] and tasks

> Quotes can hold **anything**,
> > even other quotes.

## Code

\`\`\`js
const greeting = "hello";
console.log(greeting);
\`\`\`

## Tables

| left | center | right |
|:-----|:------:|------:|
| a    | b      | c     |

---

Raw <b>HTML</b> stays text.
`;

window.onload = () => {
    translator.add({ id: "en", url: "/en.json" });
    translator.change("en");

    const source = document.querySelector("#source");
    const preview = document.querySelector("#preview");
    source.value = SAMPLE;
    preview.content = SAMPLE;
    source.addEventListener("input", () => preview.content = source.value);
}
