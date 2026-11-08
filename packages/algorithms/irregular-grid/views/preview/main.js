import { IrregularGrid, GridWorld } from "@papit/irregular-grid";

const canvas = document.querySelector("canvas");
const form = document.querySelector("form");
const ctx = canvas.getContext("2d");

let grids = [];
let scale = 1;
let hover = null; // [grid, cell]

function build() {
    const data = new FormData(form);
    const options = {
        seed: data.get("seed"),
        radius: Number(data.get("radius")),
        relax: Number(data.get("relax")),
        merge: Number(data.get("merge")),
    };
    if (data.get("chunks"))
    {
        const world = new GridWorld(options);
        grids = [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]].map(([i, j]) => world.chunk(i, j));
    }
    else
    {
        grids = [IrregularGrid.hex(options)];
    }
    draw();
}

function toScreen(x, y) {
    return [canvas.width / 2 + x * scale, canvas.height / 2 - y * scale];
}

function draw() {
    const dpr = devicePixelRatio;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const radius = Number(new FormData(form).get("radius"));
    const span = grids.length > 1 ? radius * 3 : radius;
    scale = Math.min(canvas.width, canvas.height) / (span * 2.4);

    const style = getComputedStyle(document.body);
    const ink = style.color;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = dpr;

    grids.forEach((grid, index) => {
        const p = grid.positions;
        const shade = (index * 47) % 360;
        for (let c = 0; c < grid.cellCount; c++)
        {
            ctx.beginPath();
            for (const v of grid.cornersOf(c)) ctx.lineTo(...toScreen(p[v * 2], p[v * 2 + 1]));
            ctx.closePath();

            if (hover && hover[0] === grid && hover[1] === c) ctx.fillStyle = "oklch(70% 0.15 250 / 0.6)";
            else if (hover && hover[0] === grid && grid.neighboursOf(hover[1]).includes(c)) ctx.fillStyle = "oklch(80% 0.1 150 / 0.5)";
            else ctx.fillStyle = grids.length > 1 ? `oklch(85% 0.05 ${shade} / 0.4)` : "transparent";
            ctx.fill();
            ctx.strokeStyle = ink;
            ctx.stroke();
        }
        ctx.fillStyle = "grey";
        for (let v = 0; v < grid.vertexCount; v++)
        {
            if (!grid.boundary[v]) continue;
            const [x, y] = toScreen(p[v * 2], p[v * 2 + 1]);
            ctx.fillRect(x - 2 * dpr, y - 2 * dpr, 4 * dpr, 4 * dpr);
        }
    });
}

canvas.addEventListener("pointermove", (event) => {
    const dpr = devicePixelRatio;
    const x = (event.offsetX * dpr - canvas.width / 2) / scale;
    const y = -(event.offsetY * dpr - canvas.height / 2) / scale;
    hover = null;
    for (const grid of grids)
    {
        const c = grid.cellAt(x, y);
        if (c >= 0) hover = [grid, c];
    }
    draw();
});

form.addEventListener("input", build);
addEventListener("resize", draw);
build();
