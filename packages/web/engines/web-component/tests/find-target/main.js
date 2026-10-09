import { findTarget } from "@papit/web-component";

window.findTarget = findTarget;

const host = document.getElementById("shadow-host");
const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `
    <aside class="only-inside" data-testid="only-inside"></aside>
    <div><span class="inner" data-testid="inner"></span></div>
`;
