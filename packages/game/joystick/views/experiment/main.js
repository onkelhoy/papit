// core
import { translator } from '@papit/translator';
import "@papit/codeblock";

// component
import '@papit/joystick';

window.onload = () => {
    console.log('[demo]: window loaded');

    translator.add({ id: "en", url: "/en.json" });
    translator.change("en");

    // poll every joystick per frame, like a game loop would
    const joysticks = document.querySelectorAll("pap-joystick");
    const readout = document.querySelector("#readout");
    const frame = () => {
        const active = [...joysticks].find(joystick => joystick.strength > 0) ?? joysticks[0];
        readout.textContent = `x ${active.x.toFixed(2)} · y ${active.y.toFixed(2)} · strength ${active.strength.toFixed(2)}`;
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    const button = document.querySelector("#button");
    document.addEventListener("press", event => button.textContent = `${event.target.textContent} pressed`);
    document.addEventListener("release", event => button.textContent = `${event.target.textContent} released`);

    const editable = document.querySelector("#editable");
    const layout = document.querySelector("#layout");
    // restore a saved layout, save on change
    const saved = localStorage.getItem("joystick-layout");
    if (saved) editable.layout = JSON.parse(saved);
    editable.addEventListener("layout-change", event => {
        localStorage.setItem("joystick-layout", JSON.stringify(event.detail));
        layout.textContent = JSON.stringify(event.detail, null, 2);
    });
    document.querySelector("#edit").addEventListener("change", event => editable.editable = event.target.checked);
}
