import { describe, it } from "node:test";
import assert from "node:assert";

import { Quaternion } from "@papit/quaternion";
import { Matrix4 } from "@papit/matrix";

const X = [1, 0, 0];
const Y = [0, 1, 0];
const Z = [0, 0, 1];

function close(actual, expected, eps = 1e-5) {
    assert.strictEqual(actual.length, expected.length);
    for (let i = 0; i < expected.length; i++)
    {
        assert.ok(Math.abs(actual[i] - expected[i]) < eps, `[${[...actual]}] should be close to [${[...expected]}]`);
    }
}

function angleBetween(a, b) {
    return 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
}

describe("@papit/quaternion", () => {
    describe("creating", () => {
        it("identity leaves a point alone", () => {
            close(Quaternion.identity.rotate([1, 2, 3]), [1, 2, 3]);
        });

        it("fromAxisAngle turns right-handed around the axis", () => {
            close(Quaternion.fromAxisAngle(Z, Math.PI / 2).rotate([...X]), Y);
            close(Quaternion.fromAxisAngle(X, Math.PI / 2).rotate([...Y]), Z);
            close(Quaternion.fromAxisAngle(Y, Math.PI / 2).rotate([...Z]), X);
        });

        it("fromAxisAngle accepts an axis of any length", () => {
            close(Quaternion.fromAxisAngle([0, 0, 5], 1), Quaternion.fromAxisAngle(Z, 1));
        });

        it("fromAxisAngle gives the identity for a zero axis", () => {
            close(Quaternion.fromAxisAngle([0, 0, 0], 1), Quaternion.identity);
        });

        it("normalize turns a zero quaternion into the identity", () => {
            close(new Quaternion(0, 0, 0, 0).normalize(), Quaternion.identity);
        });
    });

    describe("fromTo", () => {
        it("turns one direction onto another", () => {
            close(Quaternion.fromTo(X, Y).rotate([...X]), Y);
            close(Quaternion.fromTo([1, 2, 3], [-2, 1, .5]).rotate([1, 2, 3]).map(v => v / Math.hypot(1, 2, 3)),
                [-2, 1, .5].map(v => v / Math.hypot(-2, 1, .5)));
        });

        it("ignores the lengths", () => {
            close(Quaternion.fromTo([3, 0, 0], [0, 7, 0]), Quaternion.fromTo(X, Y));
        });

        it("is the identity for the same direction", () => {
            close(Quaternion.fromTo(X, [2, 0, 0]), Quaternion.identity);
        });

        it("makes a half turn for opposite directions", () => {
            for (const from of [X, Y, Z, [1, 2, 3], [-3, .5, 2]])
            {
                const to = from.map(v => -v);
                close(Quaternion.fromTo(from, to).rotate([...from]), to);
            }
        });

        it("gives the identity for a zero vector", () => {
            close(Quaternion.fromTo([0, 0, 0], X), Quaternion.identity);
            close(Quaternion.fromTo(X, [0, 0, 0]), Quaternion.identity);
        });
    });

    describe("combining", () => {
        it("multiplyInto applies b first, then a", () => {
            const a = Quaternion.fromAxisAngle(Z, Math.PI / 2);
            const b = Quaternion.fromAxisAngle(X, Math.PI / 2);
            const both = Quaternion.multiplyInto(Quaternion.identity, a, b);

            close(both.rotate([1, 2, 3]), a.rotate(b.rotate([1, 2, 3])));
        });

        it("multiplyInto can write into a or b", () => {
            const a = Quaternion.fromAxisAngle(Z, 1);
            const b = Quaternion.fromAxisAngle(X, 2);
            const expected = Quaternion.multiplyInto(Quaternion.identity, a, b);

            close(Quaternion.multiplyInto(a.clone, a, b), expected);
            close(Quaternion.multiplyInto(a, a, b), expected);

            const c = Quaternion.fromAxisAngle(Z, 1);
            close(Quaternion.multiplyInto(b, c, b), expected);
        });

        it("adds angles around the same axis", () => {
            const a = Quaternion.fromAxisAngle(Z, .3);
            const b = Quaternion.fromAxisAngle(Z, .4);

            close(Quaternion.multiplyInto(a, a, b), Quaternion.fromAxisAngle(Z, .7));
        });

        it("conjugate undoes a rotation", () => {
            const q = Quaternion.fromAxisAngle([1, 2, 3], 1.2);
            close(q.clone.conjugate().rotate(q.rotate([4, 5, 6])), [4, 5, 6]);
        });

        it("stays a rotation after many products when normalized", () => {
            const step = Quaternion.fromAxisAngle([1, 2, 3], .01);
            const q = Quaternion.identity;

            for (let i = 0; i < 10000; i++) Quaternion.multiplyInto(q, q, step).normalize();

            close(q, Quaternion.fromAxisAngle([1, 2, 3], 100), 1e-2);
            assert.ok(Math.abs(q.magnitude - 1) < 1e-6);
        });
    });

    describe("blending", () => {
        for (const name of ["nlerp", "slerp"])
        {
            it(`${name} lands on the ends`, () => {
                const a = Quaternion.fromAxisAngle(Z, .2);
                const b = Quaternion.fromAxisAngle(X, 1);

                close(a.clone[name](b, 0), a);
                close(a.clone[name](b, 1), b);
            });

            it(`${name} finds the middle`, () => {
                const a = Quaternion.identity;
                const b = Quaternion.fromAxisAngle(Z, Math.PI / 2);

                close(a[name](b, .5), Quaternion.fromAxisAngle(Z, Math.PI / 4));
            });

            it(`${name} takes the short way`, () => {
                const a = Quaternion.fromAxisAngle(Z, .1);
                const flipped = Quaternion.fromAxisAngle(Z, .3).multiply(-1);

                close(a[name](flipped, .5), Quaternion.fromAxisAngle(Z, .2));
            });

            it(`${name} survives two equal rotations`, () => {
                const a = Quaternion.fromAxisAngle(Z, 1);
                close(a.clone[name](a, .5), a);
            });
        }

        it("slerp moves at a constant speed where nlerp doesn't", () => {
            const a = Quaternion.identity;
            const b = Quaternion.fromAxisAngle(Z, 3);

            assert.ok(Math.abs(angleBetween(a, a.clone.slerp(b, .25)) - .75) < 1e-5);
            assert.ok(Math.abs(angleBetween(a, a.clone.nlerp(b, .25)) - .75) > .1);
        });
    });

    describe("writeMatrix", () => {
        it("agrees with the rotations in @papit/matrix", () => {
            close(Quaternion.fromAxisAngle(X, .7).writeMatrix(new Matrix4()), Matrix4.rotationX(.7));
            close(Quaternion.fromAxisAngle(Y, .7).writeMatrix(new Matrix4()), Matrix4.rotationY(.7));
            close(Quaternion.fromAxisAngle(Z, .7).writeMatrix(new Matrix4()), Matrix4.rotationZ(.7));
        });

        it("agrees with rotate", () => {
            const q = Quaternion.fromAxisAngle([1, -2, 3], 2);
            const m = q.writeMatrix(new Float32Array(16));
            const [x, y, z] = [4, 5, 6];

            close(q.rotate([x, y, z]), [
                m[0] * x + m[4] * y + m[8] * z,
                m[1] * x + m[5] * y + m[9] * z,
                m[2] * x + m[6] * y + m[10] * z,
            ]);
        });

        it("writes the position", () => {
            const m = Quaternion.identity.writeMatrix(new Float32Array(16).fill(9), [1, 2, 3]);
            close(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
        });

        it("clears an old position when none is given", () => {
            const m = Quaternion.identity.writeMatrix(new Float32Array(16).fill(9));
            close(m.slice(12), [0, 0, 0, 1]);
        });
    });
});
