import * as pixels from '@papit/pixels';

const ctx = document.querySelector("#small").getContext("2d");
ctx.fillStyle = "rgb(255 0 0)";
ctx.fillRect(0, 0, 1, 1); // only the top left pixel
document.querySelector("#gl").getContext("webgl2");

window.pixels = pixels;
