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

    // "your own controls": anything can follow the carousel through its change event
    const custom = document.getElementById("custom");
    const status = document.getElementById("custom-status");
    custom?.addEventListener("change", () => {
        status.value = `${custom.slide + 1} / ${custom.slidecount}`;
    });
}

