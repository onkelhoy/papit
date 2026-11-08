import { describe, it } from "node:test";
import assert from "node:assert";
import { Box, Capsule, collide, Manifold, Plane, RawContact, RigidBody, World } from "@papit/rigidbody";

const ids = (m) => m.points.slice(0, m.count).map(p => p.id).sort((a, b) => a - b);

function pair(world, shape, y) {
    const ground = world.add(new RigidBody({ shape: new Plane() }));
    const body = world.add(new RigidBody({ shape, mass: 1, position: { x: 0, y, z: 0 } }));
    return { ground, body, manifold: new Manifold(ground, body), raw: new RawContact() };
}

describe("Manifold", () => {
    it("keeps at most 4 points in 3D, spanning the face", () => {
        const { ground, body, manifold, raw } = pair(new World(), new Box(2, 2, 2), 0.9);
        collide(ground, body, raw);
        manifold.update(raw);
        assert.strictEqual(manifold.count, 4);
        const xs = manifold.points.map(p => Math.sign(p.a.x) * 2 + Math.sign(p.a.z));
        assert.strictEqual(new Set(xs).size, 4, "one per corner");
    });

    it("keeps at most 2 points in 2D", () => {
        const { ground, body, manifold, raw } = pair(new World({ dimensions: 2 }), new Box(2, 2), 0.9);
        collide(ground, body, raw);
        manifold.update(raw);
        assert.strictEqual(manifold.count, 2);
    });

    it("keeps ids and impulses while points stay put", () => {
        const { ground, body, manifold, raw } = pair(new World(), new Box(2, 2, 2), 0.9);
        collide(ground, body, raw);
        manifold.update(raw);
        const before = ids(manifold);
        manifold.points.forEach((p, i) => p.normalImpulse = i + 1);

        body.position.x += 0.001;
        collide(ground, body, raw);
        manifold.update(raw);
        assert.deepStrictEqual(ids(manifold), before);
        assert.ok(manifold.points.every(p => p.normalImpulse > 0), "warm start carried");
    });

    it("gives new ids once points move far", () => {
        const { ground, body, manifold, raw } = pair(new World(), new Box(2, 2, 2), 0.9);
        collide(ground, body, raw);
        manifold.update(raw);
        const before = ids(manifold);
        // an eighth turn about y moves every corner far from its old place
        body.rotation.set([0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]);
        collide(ground, body, raw);
        manifold.update(raw);
        assert.ok(ids(manifold).every(id => !before.includes(id)));
    });

    it("remembers a point a single-point query no longer reports", () => {
        // a capsule on its side: both caps, then lift one cap a hair so only one is reported deep
        const world = new World();
        const ground = world.add(new RigidBody({ shape: new Plane() }));
        const capsule = world.add(new RigidBody({
            shape: new Capsule(0.5, 2), mass: 1, position: { x: 0, y: 0.49, z: 0 },
            rotation: { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 },
        }));
        const manifold = new Manifold(ground, capsule), raw = new RawContact();
        collide(ground, capsule, raw);
        manifold.update(raw);
        const count = manifold.count;
        assert.ok(count >= 2);

        raw.count = 1; // pretend only the deepest point came back
        manifold.update(raw);
        assert.ok(manifold.count >= 2, "old points still touching are kept");
    });
});
