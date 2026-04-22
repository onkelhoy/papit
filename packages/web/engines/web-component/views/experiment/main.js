// core
import '@papit/web-component';
import { translator } from '@papit/translator';
import "@papit/typography";
import "@papit/card";
import "@papit/codeblock";

// component
import '@papit/web-component';

window.onload = () => {
    console.log('[demo]: window loaded');

    translator.add({ id: "en", url: "/en.json" });
    translator.change("en");
}

