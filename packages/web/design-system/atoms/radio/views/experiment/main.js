// core
import { translator } from '@papit/translator';
import "@papit/codeblock";
import '@papit/group';

// component
import '@papit/radio';

window.onload = () => {
    console.log('[demo]: window loaded');

    translator.add({ id: "en", url: "/en.json" });
    translator.change("en");
}

