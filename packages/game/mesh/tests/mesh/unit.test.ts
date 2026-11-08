import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/mesh/');
    await page.waitForFunction(() => (window as any).mesh);
});

test.describe("@papit/game-mesh bounds", () => {
    test('min, max and radius', async ({ page }) => {
        const b = await page.evaluate(() => (window as any).mesh.bounds(new Float32Array([1, 2, -3, -1, 0, 4])));
        expect(b.min).toEqual({ x: -1, y: 0, z: -3 });
        expect(b.max).toEqual({ x: 1, y: 2, z: 4 });
        expect(b.radius).toBeCloseTo(Math.sqrt(17), 5);
    });

    test('empty input is zero', async ({ page }) => {
        const b = await page.evaluate(() => (window as any).mesh.bounds(new Float32Array()));
        expect(b.radius).toBe(0);
        expect(b.min).toEqual({ x: 0, y: 0, z: 0 });
    });
});

test.describe("@papit/game-mesh MeshBuilder", () => {
    test('box: 36 vertices, unit bounds, outward normals', async ({ page }) => {
        const r = await page.evaluate(() => {
            const m = new (window as any).mesh.MeshBuilder().box().build();
            let outward = true;
            for (let i = 0; i < m.positions.length; i += 3)
            {
                const dot = m.positions[i] * m.normals[i] + m.positions[i + 1] * m.normals[i + 1] + m.positions[i + 2] * m.normals[i + 2];
                if (dot <= 0) outward = false;
            }
            return { count: m.positions.length / 3, colors: m.colors.length, min: m.bounds.min, max: m.bounds.max, outward };
        });
        expect(r.count).toBe(36);
        expect(r.colors).toBe(36 * 4);
        expect(r.min).toEqual({ x: -.5, y: -.5, z: -.5 });
        expect(r.max).toEqual({ x: .5, y: .5, z: .5 });
        expect(r.outward).toBe(true);
    });

    test('sphere smooth: welded to 42 vertices, normals equal positions', async ({ page }) => {
        const r = await page.evaluate(() => {
            const m = new (window as any).mesh.MeshBuilder().sphere("#f00", {}, 1).build({ smooth: true });
            let error = 0;
            for (let i = 0; i < m.positions.length; i++) error = Math.max(error, Math.abs(m.positions[i] - m.normals[i]));
            return { vertices: m.positions.length / 3, indices: m.indices.length, error, radius: m.bounds.radius, red: m.colors[0] };
        });
        expect(r.vertices).toBe(42);
        expect(r.indices).toBe(80 * 3);
        expect(r.error).toBeLessThan(1e-5);
        expect(r.radius).toBeCloseTo(1, 5);
        expect(r.red).toBe(1);
    });

    test('cylinder and cone triangle counts', async ({ page }) => {
        const r = await page.evaluate(() => {
            const B = (window as any).mesh.MeshBuilder;
            return {
                cylinder: new B().cylinder("#fff", {}, 6).build().positions.length / 9,
                cone: new B().cone("#fff", {}, 6).build().positions.length / 9,
            };
        });
        expect(r.cylinder).toBe(6 * 2 + 6 * 2);
        expect(r.cone).toBe(6 + 6);
    });

    test('add places another mesh', async ({ page }) => {
        const b = await page.evaluate(() => {
            const B = (window as any).mesh.MeshBuilder;
            return new B().add(new B().box(), { at: [10, 0, 0], scale: 2 }).build().bounds;
        });
        expect(b.min.x).toBeCloseTo(9, 5);
        expect(b.max.x).toBeCloseTo(11, 5);
        expect(b.max.y).toBeCloseTo(1, 5);
    });
});

test.describe("@papit/game-mesh upload", () => {
    test('uploads without GL errors', async ({ page }) => {
        const r = await page.evaluate(() => {
            const { MeshBuilder, upload } = (window as any).mesh;
            const gl = document.createElement("canvas").getContext("webgl2");
            if (!gl) return null;
            const flat = upload(gl, new MeshBuilder().box().build());
            const smooth = upload(gl, new MeshBuilder().sphere().build({ smooth: true }));
            const result = { flat: flat.count, indexed: smooth.indexType === gl.UNSIGNED_SHORT, error: gl.getError() };
            flat.destroy(); smooth.destroy();
            return result;
        });
        test.skip(r === null, "no webgl2");
        expect(r!.flat).toBe(36);
        expect(r!.indexed).toBe(true);
        expect(r!.error).toBe(0);
    });
});

test.describe("@papit/game-mesh glTF", () => {
    test('loads a hand-made glb', async ({ page }) => {
        const r = await page.evaluate(async () => {
            const gltf = await (window as any).mesh.loadGLTF("public/models/triangle.glb");
            const m = gltf.meshes[0].primitives[0];
            return {
                roots: gltf.roots, child: gltf.nodes[0].children, translation: gltf.nodes[0].translation, mesh: gltf.nodes[1].mesh,
                indices: Array.from(m.indices), normal: Array.from(m.normals.slice(0, 3)), color: Array.from(m.colors.slice(0, 4)),
                max: m.bounds.max,
            };
        });
        expect(r.roots).toEqual([0]);
        expect(r.child).toEqual([1]);
        expect(r.translation).toEqual([1, 2, 3]);
        expect(r.mesh).toBe(0);
        expect(r.indices).toEqual([0, 1, 2]);
        expect(r.normal).toEqual([0, 0, 1]);
        expect(r.color).toEqual([1, 0, 0, 1]);
        expect(r.max).toEqual({ x: 1, y: 1, z: 0 });
    });

    test('rejects non glTF 2 input', async ({ page }) => {
        const message = await page.evaluate(() => (window as any).mesh.parseGLTF({ asset: { version: "1.0" } }).catch((e: Error) => e.message));
        expect(message).toContain("version 2");
    });
});

test.describe("@papit/game-mesh skin", () => {
    test('rig from a skin: chain and joint matrices', async ({ page }) => {
        const r = await page.evaluate(() => {
            const node = (translation: number[], children: number[] = []) => ({ children, translation, rotation: [0, 0, 0, 1], scale: [1, 1, 1] });
            // two joints, the child 2 up; inverse binds undo the rest pose
            const inverse = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -2, 0, 1]);
            const gltf = { meshes: [], roots: [0], nodes: [node([0, 0, 0], [1]), node([0, 2, 0])], skins: [{ joints: [0, 1], inverseBindMatrices: inverse }] };
            const rig = (window as any).mesh.rig(gltf);
            const rest = Array.from(rig.update());
            rig.bones[0].rotation.setAxisAngle(0, 0, 1, Math.PI / 2);
            rig.armature.update();
            const turned = Array.from(rig.update());
            return { parent: rig.bones[1].parent === rig.bones[0], head: Array.from(rig.bones[1].head), rest, turned };
        });
        expect(r.parent).toBe(true);
        expect(r.head[0]).toBeCloseTo(-2, 5);
        // rest pose gives identity for every joint
        r.rest.forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1][i % 16], 5));
        // the child joint maps its rest point (0, 2, 0) to (-2, 0, 0): column 3 = R * (0,-2,0) + head
        expect(r.turned[16 + 12] + r.turned[16 + 4] * 2).toBeCloseTo(-2, 5);
    });
});

test.describe("@papit/game-mesh animation", () => {
    test('samples linear, step and rotation keys into a rig', async ({ page }) => {
        const r = await page.evaluate(() => {
            const m = (window as any).mesh;
            const linear = { node: 0, path: "translation", interpolation: "LINEAR", times: new Float32Array([0, 2]), values: new Float32Array([0, 0, 0, 4, 0, 0]) };
            const step = { ...linear, interpolation: "STEP" };
            const out = new Float32Array(4);
            const half = Array.from(m.sampleChannel(linear, 1, 3, out).slice(0, 3));
            const stepped = Array.from(m.sampleChannel(step, 1.9, 3, out).slice(0, 3));
            const clamped = Array.from(m.sampleChannel(linear, 5, 3, out).slice(0, 3));

            const s = Math.SQRT1_2;
            const rotation = { node: 0, path: "rotation", interpolation: "LINEAR", times: new Float32Array([0, 1]), values: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0]) };
            const node = { children: [], translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
            const rig = m.rig({ meshes: [], roots: [0], nodes: [node], skins: [{ joints: [0] }], animations: [] });
            m.sample({ duration: 1, channels: [rotation] }, .5, rig, false);
            return { half, stepped, clamped, quat: Array.from(rig.bones[0].rotation), s };
        });
        expect(r.half[0]).toBeCloseTo(2, 5);
        expect(r.stepped[0]).toBe(0);
        expect(r.clamped[0]).toBeCloseTo(4, 5);
        // halfway from identity to 180 degrees around z: 90 degrees
        expect(r.quat[2]).toBeCloseTo(r.s, 4);
        expect(r.quat[3]).toBeCloseTo(r.s, 4);
    });
});
