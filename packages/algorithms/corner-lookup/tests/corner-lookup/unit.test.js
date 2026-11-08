import { describe, it } from "node:test";
import assert from "node:assert";
import { CornerTable, transformPattern, permuteCorner } from "@papit/corner-lookup";

describe("case counts (Burnside)", () => {
    it("cube, rotation only: 70", () => assert.strictEqual(new CornerTable({ corners: 8 }).cases.length, 70));
    it("cube, rotation and mirror: 55", () => assert.strictEqual(new CornerTable({ corners: 8, mirror: true }).cases.length, 55));
    it("square, rotation only: 6", () => assert.strictEqual(new CornerTable({ corners: 4 }).cases.length, 6));
    it("square, rotation and mirror: 6", () => assert.strictEqual(new CornerTable({ corners: 4, mirror: true }).cases.length, 6));
});

describe("lookup", () => {
    for (const options of [{ corners: 8 }, { corners: 8, mirror: true }, { corners: 4 }])
    {
        it(`transform restores every pattern ${JSON.stringify(options)}`, () => {
            const table = new CornerTable(options);
            for (let p = 0; p < 1 << table.corners; p++)
            {
                const { canonical, rotation, mirror } = table.lookup(p);
                assert.strictEqual(transformPattern(canonical, table.corners, rotation, mirror), p);
                assert.ok(table.cases.includes(canonical));
                assert.ok(canonical <= p);
            }
        });
    }

    it("empty and full are their own cases", () => {
        const table = new CornerTable();
        assert.deepStrictEqual(table.lookup(0), { canonical: 0, rotation: 0, mirror: false });
        assert.deepStrictEqual(table.lookup(255), { canonical: 255, rotation: 0, mirror: false });
    });

    it("prefers no mirror when a rotation is enough", () => {
        const table = new CornerTable({ mirror: true });
        assert.strictEqual(table.lookup(0b0010).mirror, false);
        assert.strictEqual(table.lookup(0b0010).rotation, 1);
    });
});

describe("permuteCorner", () => {
    it("rotates within a layer", () => {
        assert.strictEqual(permuteCorner(3, 1), 0);
        assert.strictEqual(permuteCorner(7, 2), 5);
    });

    it("mirror reverses corner order", () => {
        assert.strictEqual(permuteCorner(0, 0, true), 3);
        assert.strictEqual(permuteCorner(5, 0, true), 6);
    });

    it("pattern from values", () => {
        assert.strictEqual(CornerTable.pattern([1, 0, true, 0, 0, 0, 0, "x"]), 0b10000101);
    });
});
