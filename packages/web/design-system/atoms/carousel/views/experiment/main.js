// core
import { translator, useTranslator } from '@papit/translator';
import "@papit/codeblock";

// component
import '@papit/carousel';

window.onload = () => {
    console.log('[demo]: window loaded');

    window.translator = translator;
    translator.add({ id: "en", url: "/en.json" });
    translator.change("en");

    window.t = useTranslator();
}

