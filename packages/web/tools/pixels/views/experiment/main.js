import { Pixels } from '@papit/pixels';

const canvas = document.querySelector("canvas");
const output = document.querySelector("output");
const ctx = canvas.getContext("2d");

const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
gradient.addColorStop(0, "red");
gradient.addColorStop(1, "blue");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, canvas.width, canvas.height);

const pixels = Pixels.FromCanvas(canvas);
window.pixels = pixels;

canvas.addEventListener("mousemove", event => {
    const { r, g, b, col, row } = pixels.get(event.offsetX, event.offsetY);
    output.textContent = `${col}, ${row}: rgb(${r} ${g} ${b})`;
});
