// core
import { translator } from '@papit/translator';
import "@papit/codeblock";

// component
import '@papit/switch';

window.onload = () => {
    console.log('[demo]: window loaded');

    const form = document.querySelector("form");
    form.onsubmit = (e) => {
        e.preventDefault();
        const data = new FormData(form);

        console.log("submit", {
            a: data.get("a"),
            b: data.get("b"),
        })
    }
}
