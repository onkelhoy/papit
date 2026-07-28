// core
import { translator } from '@papit/translator';
import "@papit/codeblock";
import "@papit/tabs";
import "@papit/router";

// component
import '@papit/web-component';

window.onload = () => {
    console.log('[demo]: window loaded');

    translator.add({ id: "en", url: "/en.json" });
    translator.change("en");

    const tabs = document.querySelector("pap-tabs.individual-showcase");
    const router = document.querySelector("pap-router.individual-showcase");

    tabs.addEventListener("change", e => {
        console.log(tabs, e.target.value);
        router.url = e.target.value;
    })
}

