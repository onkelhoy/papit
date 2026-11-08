import { Camera, GameEngine, orbit } from '@papit/game-engine';
import { IrregularGrid } from '@papit/irregular-grid';
import { rayTriangle } from '@papit/triangle-intersection';
import { Structure, StructureObject, ModuleLibrary, blockModules, blockGeometry, surfaceModules, touchingSides } from '@papit/structure';
import { Random } from '@papit/random';

const HEIGHT = 1;
const form = document.querySelector("form");
const engine = new GameEngine({ name: "main", query: "canvas", type: "webgl2" });
const layer = engine.layers.main;
const camera = new Camera({ controllers: [orbit({ distance: 16, yaw: .6, pitch: .6 })] });
layer.camera = camera;
layer.gl.clearColor(0, 0, 0, 0);

const plain = new ModuleLibrary(blockModules());

// the same blocks in three roof colours; sockets make touching modules share a colour
const ROOFS = { red: "#c0503c", blue: "#4a6fa5", green: "#5f8f4e" };
const variants = new ModuleLibrary(Object.entries(ROOFS).flatMap(([name, top]) => blockModules({ top }).map((module) => ({
    ...module,
    id: module.id + "-" + name,
    sockets: Object.fromEntries(touchingSides(module.pattern).map((side) => [side, name])),
}))));

// farmland: flat plots on the ground layer only, the game's own modules; wfc gives each field one crop
const CROPS = { wheat: "#d8b55a", grass: "#7da35a", soil: "#8a6243" };
const farmland = new ModuleLibrary(Object.entries(CROPS).flatMap(([name, top]) => blockModules().filter((m) => (m.pattern & 0xf0) === 0).map((module) => ({
    ...module,
    id: module.id + "-" + name,
    geometry: flatten(blockGeometry(module.pattern, { top, wall: "#6b5a44" }), .25),
    sockets: Object.fromEntries(touchingSides(module.pattern).filter((side) => side !== "top").map((side) => [side, name])),
}))));

// smooth ground from the marching cubes table
const terrain = new ModuleLibrary(surfaceModules());

function flatten(mesh, height) {
    for (let i = 1; i < mesh.positions.length; i += 3) mesh.positions[i] *= height * 2;
    return mesh;
}

let structure, object;

function build() {
    const data = new FormData(form);
    const seed = data.get("seed");
    const style = data.get("style");
    const grid = IrregularGrid.hex({ radius: 6, seed, size: 1.6 });
    if (style === "terrain") structure = new Structure(grid, terrain, { layers: 8, layerHeight: HEIGHT, seed, chunkSize: 4 });
    else if (style === "farmland") structure = new Structure(grid, farmland, { layers: 1, layerHeight: HEIGHT, seed, chunkSize: 4 });
    else structure = new Structure(grid, data.get("variants") ? variants : plain, { layers: 8, layerHeight: HEIGHT, seed, chunkSize: 4 });

    if (style === "terrain") hills(grid, seed);
    else if (style === "farmland") fields(grid);
    else city(grid);

    if (object) engine.remove(object);
    object = engine.add(new StructureObject(structure));
    info();
}

// rolling hills: a seeded sum of waves as a height per vertex
function hills(grid, seed) {
    const random = new Random(seed);
    const waves = Array.from({ length: 4 }, () => [random.next() * 6.28, random.next() * 6.28, .3 + random.next() * .5, random.next() * 6.28]);
    for (let v = 0; v < grid.vertexCount; v++)
    {
        const p = grid.vertex(v);
        let h = 2;
        for (const [a, b, f, phase] of waves) h += Math.sin((Math.cos(a) * p.x + Math.sin(b) * p.y) * f + phase);
        for (let k = 0; k <= Math.max(0, Math.min(structure.layers - 1, h)); k++) structure.set(v, k, 1);
    }
}

// everything filled except a road through the middle
function fields(grid) {
    for (let v = 0; v < grid.vertexCount; v++)
    {
        const p = grid.vertex(v);
        if (Math.abs(p.y - p.x * .4) > .9) structure.set(v, 0, 1);
    }
}

function city(grid) {

    // three islands, one with a tower; with roof colours each island gets its own colour
    const islands = [[-3, -2, 2.6], [3, -1.5, 2.4], [0, 3.5, 2.4]];
    for (let v = 0; v < grid.vertexCount; v++)
    {
        const p = grid.vertex(v);
        if (islands.some(([x, y, r]) => Math.hypot(p.x - x, p.y - y) < r)) structure.set(v, 0, 1);
        if (Math.hypot(p.x + 3, p.y + 2) < 1.2) structure.set(v, 1, 1);
        if (Math.hypot(p.x + 3, p.y + 2) < 0.7) structure.set(v, 2, 1);
    }
}

function info() {
    let filled = 0;
    for (const id of structure.occupancy) if (id) filled++;
    form.elements.info.value = `${structure.grid.cellCount} cells, ${filled} filled`;
}

// mouse ray from the camera, perspective
function ray(event) {
    const rect = engine.canvas.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((event.clientY - rect.top) / rect.height) * 2;
    const m = camera.worldMatrix;
    const tan = Math.tan(camera.fov / 2) / camera.zoom;
    const aspect = rect.width / rect.height;
    const x = nx * tan * aspect, y = ny * tan, z = -1;
    const direction = {
        x: m[0] * x + m[4] * y + m[8] * z,
        y: m[1] * x + m[5] * y + m[9] * z,
        z: m[2] * x + m[6] * y + m[10] * z,
    };
    return { origin: { x: m[12], y: m[13], z: m[14] }, direction };
}

// closest hit on the baked meshes, else the ground plane
function pick(event) {
    const { origin, direction } = ray(event);
    let best = null;
    for (const chunk of structure.baked)
    {
        const p = chunk.mesh.positions, n = chunk.mesh.normals;
        for (let t = 0; t < p.length; t += 9)
        {
            const hit = rayTriangle(origin, direction,
                { x: p[t], y: p[t + 1], z: p[t + 2] },
                { x: p[t + 3], y: p[t + 4], z: p[t + 5] },
                { x: p[t + 6], y: p[t + 7], z: p[t + 8] });
            if (hit && hit.t > 0 && (!best || hit.t < best.t))
            {
                best = { t: hit.t, point: hit.point, normal: { x: n[t], y: n[t + 1], z: n[t + 2] }, ground: false };
            }
        }
    }
    if (best) return best;

    const groundY = -HEIGHT / 2;
    if (direction.y >= 0) return null;
    const t = (groundY - origin.y) / direction.y;
    return {
        t,
        point: { x: origin.x + direction.x * t, y: groundY, z: origin.z + direction.z * t },
        normal: { x: 0, y: 1, z: 0 },
        ground: true,
    };
}

// the vertex and layer at a world point
function vertexAt(x, y, z) {
    const grid = structure.grid;
    const c = grid.cellAt(x, z);
    if (c < 0) return null;
    let nearest = -1, distance = Infinity;
    for (const v of grid.cornersOf(c))
    {
        const p = grid.vertex(v);
        const d = Math.hypot(p.x - x, p.y - z);
        if (d < distance) { distance = d; nearest = v; }
    }
    return { v: nearest, k: Math.round(y / HEIGHT) };
}

let down = null;
engine.canvas.addEventListener("pointerdown", (event) => down = [event.clientX, event.clientY]);
engine.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
engine.canvas.addEventListener("pointerup", (event) => {
    if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
    const hit = pick(event);
    if (!hit) return;
    const remove = event.shiftKey || event.button === 2;
    if (remove && hit.ground) return;

    const step = (remove ? -0.25 : 0.25) * HEIGHT;
    const target = vertexAt(hit.point.x + hit.normal.x * step, hit.point.y + hit.normal.y * step, hit.point.z + hit.normal.z * step);
    if (!target) return;
    structure.set(target.v, target.k, remove ? 0 : 1);
    info();
});

form.addEventListener("change", build);
build();
engine.start();
