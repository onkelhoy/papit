// core
import { translator } from '@papit/translator';
import "@papit/codeblock";

// component
import '@papit/showcase';

window.onload = () => {
    console.log('[demo]: window loaded');

    translator.add({ id: "en", url: "/en.json" });
    translator.change("en");
}

