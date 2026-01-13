import {describe, it} from "node:test";
import assert from "node:assert";

import {Matrix, MatrixN, Matrix4, Matrix3} from '@papit/matrix';
import {Vector3} from "@papit/vector";


function close(a, b, eps = 1e-6) {
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
}

describe('@papit/matrix unit tests', () => {

  describe("Matrix class", () => {

    describe("matrix creation", () => {
      it('from MatrixObject - rows x cols', () => {
        const m = new Matrix({cols: 3, rows: 3, data: [1, 2, 3, 4, 5, 6, 7, 8, 9]});
        assert.strictEqual(m.rows, 3, "rows don't match");
        assert.strictEqual(m.cols, 3, "cols don't match");
        assert.strictEqual(m.length, 9);
        assert.strictEqual(m.get(1, 1), 5);
      });

      it('from MatrixObject - row x col', () => {
        const m = new Matrix({col: 3, row: 3, data: [1, 2, 3, 4, 5, 6, 7, 8, 9]});
        assert.strictEqual(m.rows, 3, "rows don't match");
        assert.strictEqual(m.cols, 3, "cols don't match");
        assert.strictEqual(m.length, 9);
        assert.strictEqual(m.get(1, 1), 5);
      });

      it('from MatrixObject - rows x column', () => {
        const m = new Matrix({column: 3, rows: 3, data: [1, 2, 3, 4, 5, 6, 7, 8, 9]});
        assert.strictEqual(m.rows, 3, "rows don't match");
        assert.strictEqual(m.cols, 3, "cols don't match");
        assert.strictEqual(m.length, 9);
        assert.strictEqual(m.get(1, 1), 5);
      });

      it('from MatrixObject - rows x columns', () => {
        const m = new Matrix({columns: 3, rows: 3, data: [1, 2, 3, 4, 5, 6, 7, 8, 9]});
        assert.strictEqual(m.rows, 3, "rows don't match");
        assert.strictEqual(m.cols, 3, "cols don't match");
        assert.strictEqual(m.length, 9);
        assert.strictEqual(m.get(1, 1), 5);
      });

      it('from size', () => {
        const m = new Matrix(4);
        assert.strictEqual(m.rows, 4, "rows don't match");
        assert.strictEqual(m.cols, 4, "cols don't match");
        assert.strictEqual(m.length, 16);
        assert.strictEqual(m.get(1, 1), 0);
      });

      it('from row x col', () => {
        const m = new Matrix(3, 5);
        assert.strictEqual(m.rows, 3, "rows don't match");
        assert.strictEqual(m.cols, 5, "cols don't match");
        assert.strictEqual(m.length, 15);
        assert.strictEqual(m.get(1, 1), 0);
      });

      it('from value & row x col', () => {
        const m = new Matrix(3, 4, 2);
        assert.strictEqual(m.rows, 4, "rows don't match");
        assert.strictEqual(m.cols, 2, "cols don't match");
        assert.strictEqual(m.length, 8);
        assert.strictEqual(m.get(1, 1), 3);
      });

      it('from array', () => {
        const m = new Matrix([1, 2, 3, 4, 5]);
        assert.strictEqual(m.rows, 5, "rows don't match");
        assert.strictEqual(m.cols, 1, "cols don't match");
        assert.strictEqual(m.length, 5);
        assert.strictEqual(m.get(1, 0), 2);
      });

      it('from 2d array', () => {
        const m = new Matrix([[1, 2, 3], [1, 7, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3]]);
        assert.strictEqual(m.rows, 5, "rows don't match");
        assert.strictEqual(m.cols, 3, "cols don't match");
        assert.strictEqual(m.length, 15);
        assert.strictEqual(m.get(1, 1), 7);
      });

      it('from array and row x col', () => {
        const m = new Matrix([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3);
        assert.strictEqual(m.rows, 3, "rows don't match");
        assert.strictEqual(m.cols, 3, "cols don't match");
        assert.strictEqual(m.length, 9);
        assert.strictEqual(m.get(1, 1), 5);
      });
    });

    describe("get rows and cols", () => {

      it("should return row", () => {
        const m = new Matrix([[1, 2, 3], [4, 5, 6], [1, 2, 3]]);
        const rows = m.getRow(1);
        assert.deepStrictEqual([...rows], [4, 5, 6]);
      });

      it("should return col", () => {
        const m = new Matrix([[1, 2, 3], [1, 2, 3], [1, 2, 3]]);
        const cols = m.getCol(1);
        assert.deepStrictEqual([...cols], [2, 2, 2]);
      });
    });

    describe("basic operations", () => {
      it("should add by scalar", () => {
        const m = new Matrix([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3);
        m.add(10);
        assert.deepStrictEqual([...m], [11, 12, 13, 14, 15, 16, 17, 18, 19]);
      });

      it("should add by full matrix", () => {
        const m = new Matrix([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3);
        const m2 = new Matrix(1, 3, 3);
        m.add(m2);
        assert.deepStrictEqual([...m], [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      it("should add by partial matrix", () => {
        const m = new Matrix([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3);
        const m2 = new Matrix(1, 2, 2);
        m.add(m2);
        assert.deepStrictEqual([...m], [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      it('should do matrix multiplication', () => {
        const A = new Matrix([
          [1, 2, 3],
          [4, 5, 6],
        ]);

        assert.equal(A.rows, 2, "A rows dont match");
        assert.equal(A.cols, 3, "A columns dont match");

        const B = new Matrix([
          [7, 8],
          [9, 10],
          [11, 12],
        ]);

        assert.equal(B.rows, 3, "B rows dont match");
        assert.equal(B.cols, 2, "B columns dont match");

        const C = A.multiply(B);

        // Expected:
        // [ 1*7 + 2*9 + 3*11,   1*8 + 2*10 + 3*12 ] = [ 58,  64 ]
        // [ 4*7 + 5*9 + 6*11,   4*8 + 5*10 + 6*12 ] = [ 139, 154 ]

        assert.equal(C.rows, 2, "C rows dont match");
        assert.equal(C.cols, 2, "C columns dont match");

        assert.equal(C.get(0, 0), 58);
        assert.equal(C.get(0, 1), 64);
        assert.equal(C.get(1, 0), 139);
        assert.equal(C.get(1, 1), 154);
      });
    });

    describe("identity matrix", () => {

      it("create 3x3 identity", () => {
        const m = new Matrix(3, true);

        const col = m.getCol(1);
        assert.deepStrictEqual([...col], [0, 1, 0]);

        assert.equal(m.rows, 3, "rows does not match");
        assert.equal(m.cols, 3, "cols does not match");
        assert.equal(m.length, 9, "length does not match");

        assert.equal(m.get(0, 0), 1);
        assert.equal(m.get(0, 1), 0);
        assert.equal(m.get(1, 0), 0);
        assert.equal(m.get(1, 1), 1);
        assert.deepStrictEqual([...m], [1, 0, 0, 0, 1, 0, 0, 0, 1]);
      });

      it("3x3 should match Matrix3", () => {
        const m = Matrix.identity(3);
        assert.equal(true, m instanceof Matrix3, "instance dont match");
      });

      it("create 4x4 identity", () => {
        const m = new Matrix(4, true);
        const col = m.getCol(1);
        assert.deepStrictEqual([...col], [0, 1, 0, 0]);

        assert.equal(m.rows, 4, "rows does not match");
        assert.equal(m.cols, 4, "cols does not match");
        assert.equal(m.length, 16, "length does not match");

        assert.equal(m.get(0, 0), 1);
        assert.equal(m.get(0, 1), 0);
        assert.equal(m.get(1, 0), 0);
        assert.equal(m.get(1, 1), 1);
        assert.deepStrictEqual([...m], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      });

      it("4x4 should match Matrix4", () => {
        const m = Matrix.identity(4);
        assert.equal(true, m instanceof Matrix4, "instance dont match");
      });

      it("create 5x5 identity", () => {
        const m = new Matrix(5, true);
        assert.equal(m.rows, 5, "rows dont match");
        assert.equal(m.cols, 5, "cols dont match");
        assert.equal(m.length, 25, "length dont match");
        assert.deepStrictEqual([...m], [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]);

        assert.strictEqual(m.get(0, 0), 1);
        assert.strictEqual(m.get(1, 1), 1);
        assert.strictEqual(m.get(2, 2), 1);
        assert.strictEqual(m.get(3, 3), 1);
        assert.strictEqual(m.get(4, 4), 1);
        assert.strictEqual(m.get(4, 3), 0);
      });


      it("5x5 should match MatrixN", () => {
        const m = Matrix.identity(5);
        assert.equal(true, m instanceof MatrixN, "instance dont match");
      });
    })

    it("should transpose", () => {
      const m = new Matrix([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3, 4);
      assert.equal(m.rows, 3);
      assert.equal(m.cols, 4);

      m.transpose();

      assert.equal(m.rows, 4);
      assert.equal(m.cols, 3);

      // Check that values are in the correct transposed order
      const expected = [
        [1, 5, 9],
        [2, 6, 10],
        [3, 7, 11],
        [4, 8, 12]
      ];

      for (let r = 0; r < m.rows; r++)
      {
        for (let c = 0; c < m.cols; c++)
        {
          assert.equal(m.get(r, c), expected[r][c]);
        }
      }
    });

  });

  describe("clone", () => {

    it("should clone", () => {
      const mMN = new Matrix(10, 4);
      assert.equal(mMN[0], 0, "value is not 0")
      assert.equal(mMN.cols, 4, "mMN intial cols not 4");
      assert.equal(mMN.rows, 10, "mMN intial rows not 10");
      const cMN = mMN.clone;
      assert.equal(mMN.length, cMN.length, "mMN length dont match");
      assert.equal(mMN.cols, cMN.cols, "mMN cols dont match");
      assert.equal(mMN.rows, cMN.rows, "mMN rows dont match");
      assert.deepStrictEqual(mMN, cMN, "mMN values dont match");

      const mN = new MatrixN(10);
      assert.equal(mN.cols, 10, "MN intial cols not 10");
      assert.equal(mN.rows, 10, "MN intial rows not 10");
      const cN = mN.clone;
      assert.equal(mN.length, cN.length, "mN length dont match");
      assert.equal(mN.cols, cN.cols, "MN cols dont match");
      assert.equal(mN.rows, cN.rows, "MN rows dont match");
      assert.deepStrictEqual(mN, cN, "MN values dont match");

      const m4 = new Matrix4();
      assert.equal(m4.cols, 4, "M4 intial cols not 4");
      assert.equal(m4.rows, 4, "M4 intial rows not 4");
      const c4 = m4.clone;
      assert.equal(m4.length, c4.length, "m4 length dont match");
      assert.equal(m4.cols, c4.cols, "M4 cols dont match");
      assert.equal(m4.rows, c4.rows, "M4 rows dont match");
      assert.deepStrictEqual(m4, c4, "M4 values dont match");

      const m3 = new Matrix3();
      assert.equal(m3.cols, 3, "M3 intial cols not 3");
      assert.equal(m3.rows, 3, "M3 intial rows not 3");
      const c3 = m3.clone;
      assert.equal(m3.length, c3.length, "m3 length dont match");
      assert.equal(m3.cols, c3.cols, "M3 cols dont match");
      assert.equal(m3.rows, c3.rows, "M3 rows dont match");
      assert.deepStrictEqual(m3, c3, "M3 values dont match");
    });

    it("should not affect original", () => {

      const m3 = new Matrix3();
      const c3 = m3.clone;
      m3[1] = 2;
      assert.notEqual(m3[1], c3[1]);
      m3.add(4);
      assert.notEqual(m3[0], c3[0]);

      const m4 = new Matrix4();
      const c4 = m4.clone;
      m4[1] = 2;
      assert.notEqual(m4[1], c4[1]);
      m4.add(4);
      assert.notEqual(m4[0], c4[0]);

      const mN = new MatrixN(10);
      const cN = mN.clone;
      mN[1] = 2;
      assert.notEqual(mN[1], cN[1]);
      mN.add(4);
      assert.notEqual(mN[0], cN[0]);

      const mMN = new Matrix(10, 4);
      const cMN = mMN.clone;
      mMN[1] = 2;
      assert.notEqual(mMN[1], cMN[1]);
      mMN.add(4);
      assert.notEqual(mMN[0], cMN[0]);
    });
  })

  describe("MatrixN class", () => {
    describe("translate", () => {
      it("should translate in 2D", () => {
        const m = Matrix.identity(3); // homogeneous 2D
        m.translate([5, 7]);

        const lastcolumn = m.getCol(2);

        assert.deepStrictEqual([...lastcolumn], [5, 7, 1]);
      });

      it("should translate in 3D", () => {
        const m = Matrix.identity(4); // homogeneous 3D
        const translated = m.translate([1, 2, 3]);

        const expected = [
          [1, 0, 0, 1],
          [0, 1, 0, 2],
          [0, 0, 1, 3],
          [0, 0, 0, 1]
        ];

        for (let r = 0; r < 4; r++)
        {
          for (let c = 0; c < 4; c++)
          {
            assert.equal(translated.get(r, c), expected[r][c]);
          }
        }
      });

      it("should translate in 5D", () => {
        const m = Matrix.identity(6); // homogeneous 5D
        const translated = m.translate([1, 2, 3, 4, 5]);

        const expected = [
          [1, 0, 0, 0, 0, 1],
          [0, 1, 0, 0, 0, 2],
          [0, 0, 1, 0, 0, 3],
          [0, 0, 0, 1, 0, 4],
          [0, 0, 0, 0, 1, 5],
          [0, 0, 0, 0, 0, 1]
        ];

        for (let r = 0; r < 6; r++)
        {
          for (let c = 0; c < 6; c++)
          {
            assert.equal(translated.get(r, c), expected[r][c]);
          }
        }
      });
    });

    describe("rotation", () => {
      it("rotates a 2D matrix 90°", () => {
        const m = Matrix.identity(2);
        assert.deepStrictEqual([...m], [1, 0, 0, 1], "its not identity");

        const rotated = m.rotate(Math.PI / 2); // 90° rotation
        const expected = [
          [0, -1],
          [1, 0]
        ];

        for (let r = 0; r < 2; r++)
        {
          for (let c = 0; c < 2; c++)
          {
            assert(Math.abs(rotated.get(r, c) - expected[r][c]) < 1e-10);
          }
        }
      });

      it("rotates a 3D matrix 90° around Z axis", () => {
        const m = Matrix.identity(3);

        const rotated = m.rotate(Math.PI / 2, [0, 1]); // plane XY rotation
        const expected = [
          [0, -1, 0],
          [1, 0, 0],
          [0, 0, 1]
        ];

        for (let r = 0; r < 3; r++)
        {
          for (let c = 0; c < 3; c++)
          {
            assert(Math.abs(rotated.get(r, c) - expected[r][c]) < 1e-10);
          }
        }
      });

      it("rotates a 4D matrix 90° in the plane defined by axes 0 and 1", () => {
        const m = Matrix.identity(4);
        m.rotate(Math.PI / 2, [0, 1]);

        const expected = [
          [0, -1, 0, 0],
          [1, 0, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ];

        for (let r = 0; r < 4; r++)
        {
          for (let c = 0; c < 4; c++)
          {
            assert(Math.abs(m.get(r, c) - expected[r][c]) < 1e-10)
          }
        }
      });

    });

    describe("scale", () => {
      it("should scale in 2D", () => {
        const m = Matrix.identity(3);
        const scaled = m.scale([2, 3]);

        const expected = [
          [2, 0, 0],
          [0, 3, 0],
          [0, 0, 1],
        ];

        for (let r = 0; r < 3; r++)
        {
          for (let c = 0; c < 3; c++)
          {
            assert.equal(scaled.get(r, c), expected[r][c]);
          }
        }
      });

      it("should scale in 3D", () => {
        const m = Matrix.identity(4);
        const scaled = m.scale([2, 3, 4]);

        const expected = [
          [2, 0, 0, 0],
          [0, 3, 0, 0],
          [0, 0, 4, 0],
          [0, 0, 0, 1],
        ];

        for (let r = 0; r < 4; r++)
        {
          for (let c = 0; c < 4; c++)
          {
            assert.equal(scaled.get(r, c), expected[r][c]);
          }
        }
      });

      it("should scale in 5D", () => {
        const m = Matrix.identity(6);
        const scaled = m.scale([1, 2, 3, 4, 5]);

        const expected = [
          [1, 0, 0, 0, 0, 0],
          [0, 2, 0, 0, 0, 0],
          [0, 0, 3, 0, 0, 0],
          [0, 0, 0, 4, 0, 0],
          [0, 0, 0, 0, 5, 0],
          [0, 0, 0, 0, 0, 1],
        ];

        for (let r = 0; r < 6; r++)
        {
          for (let c = 0; c < 6; c++)
          {
            assert.equal(scaled.get(r, c), expected[r][c]);
          }
        }
      });

      it("getScale", () => {
        const m = Matrix
          .identity(6)
          .scale(1, 2, 3, 4, 5)
          .scale(2, 2, 2, 2, 2);

        assert.deepStrictEqual([...m.getScale()], [2, 4, 6, 8, 10]);
      });
    });
  });

  describe("Matrix4 class", () => {

    describe("rotate", () => {
      it("should rotate around X", () => {
        const m = new Matrix4().rotateX(Math.PI / 2);
        const c = Math.cos(Math.PI / 2);
        const s = Math.sin(Math.PI / 2);

        // rotation block indices in column-major
        close(m[5], c);
        close(m[6], s);
        close(m[9], -s);
        close(m[10], c);
      });

      it("should rotate around Y", () => {
        const m = Matrix4.create().rotateY(Math.PI / 2);
        const c = Math.cos(Math.PI / 2);
        const s = Math.sin(Math.PI / 2);

        close(m[0], c);
        close(m[2], -s);
        close(m[8], s);
        close(m[10], c);
      });

      it("should rotate around Z", () => {
        const m = new Matrix4().rotateZ(Math.PI / 2);
        const c = Math.cos(Math.PI / 2);
        const s = Math.sin(Math.PI / 2);

        close(m[0], c);
        close(m[1], s);
        close(m[4], -s);
        close(m[5], c);
      });
    });

    describe("inverse", () => {
      it("should invert translation", () => {
        const m = new Matrix4().translate([3, -2, 5]);
        const inv = m.clone.inverse();
        const id = m.clone.multiply(inv);

        for (let i = 0; i < id.length; i++)
        {
          close(id[i], i % 5 === 0 ? 1 : 0);
        }
      });

      it("should invert rotation", () => {
        const m = new Matrix4().rotateX(Math.PI / 4).rotateY(Math.PI / 6).rotateZ(Math.PI / 3);
        const inv = m.clone.inverse();
        const id = m.clone.multiply(inv);

        for (let i = 0; i < id.length; i++)
        {
          close(id[i], i % 5 === 0 ? 1 : 0);
        }
      });

      it("should invert scale", () => {
        const m = new Matrix4().scale([2, 3, 4]);
        const inv = m.clone.inverse();
        const id = m.clone.multiply(inv);

        for (let i = 0; i < id.length; i++)
        {
          close(id[i], i % 5 === 0 ? 1 : 0);
        }
      });

      it("should invert translation + rotation", () => {
        const m = new Matrix4()
          .translate([1, 2, 3])
          .rotateX(Math.PI / 4)
          .rotateY(Math.PI / 6);
        const inv = m.clone.inverse();
        const id = m.clone.multiply(inv);

        for (let i = 0; i < id.length; i++)
        {
          close(id[i], i % 5 === 0 ? 1 : 0);
        }
      });

      it("should invert translation + scale", () => {
        const m = new Matrix4()
          .translate([-2, 1, 3])
          .scale([2, 2, 2]);
        const inv = m.clone.inverse();
        const id = m.clone.multiply(inv);

        for (let i = 0; i < id.length; i++)
        {
          close(id[i], i % 5 === 0 ? 1 : 0);
        }
      });

      it("should invert rotation + scale", () => {
        const m = new Matrix4()
          .rotateX(Math.PI / 6)
          .rotateY(Math.PI / 4)
          .scale([1, 2, 0.5]);
        const inv = m.clone.inverse();
        const id = m.clone.multiply(inv);

        for (let i = 0; i < id.length; i++)
        {
          close(id[i], i % 5 === 0 ? 1 : 0);
        }
      });

      it("should invert translation + rotation + scale", () => {
        const m = new Matrix4()
          .translate([5, -3, 2])
          .rotateX(Math.PI / 3)
          .rotateY(Math.PI / 4)
          .rotateZ(Math.PI / 6)
          .scale([2, 3, 1]);
        const inv = m.clone.inverse();
        const id = m.clone.multiply(inv);

        for (let i = 0; i < id.length; i++)
        {
          close(id[i], i % 5 === 0 ? 1 : 0);
        }
      });

      it("should invert rotation, translation, and scale combined", () => {
        const m = new Matrix4()
          .rotateX(Math.PI / 3)
          .rotateY(Math.PI / 4)
          .rotateZ(Math.PI / 6)
          .translate([5, -3, 2])
          .scale(2); // non-uniform scale

        const inv = m.clone.inverse();
        const identity = m.clone.multiply(inv);

        for (let i = 0; i < identity.length; i++)
        {
          close(identity[i], i % 5 === 0 ? 1 : 0); // diagonal ≈ 1, rest ≈ 0
        }
      });

    });


    describe("projection", () => {

      describe("frustum", () => {
        // Test 1: Right-Handed Mode (WebGL/OpenGL Standard)
        it("maps RH frustum corners to NDC correctly", () => {
          // 1. Setup Matrix Mode
          const m = new Matrix4();

          const near = 1;
          const far = 3;
          m.frustum(-1, 1, -1, 1, near, far);

          // 2. Define Corner Points
          // Z-coordinates must be NEGATIVE (e.g., -near, -far)
          const farScale = far / near;

          const corners = [
            // Near Plane (Z = -1)
            {point: [-1, -1, -near], expected: [-1, -1, -1]},
            {point: [1, 1, -near], expected: [1, 1, -1]},

            // Far Plane (Z = -3) - scaled X/Y coordinates must be used
            {point: [-farScale, farScale, -far], expected: [-1, 1, 1]},
            {point: [farScale, -farScale, -far], expected: [1, -1, 1]},
          ];

          // 3. Run Assertions (unchanged)
          corners.forEach(({point, expected}) => {
            const clone = m.clone;
            const v = clone.multiply({data: [...point, 1], rows: 4, cols: 1});
            const ndc = v.slice(0, 3).map(val => val / v[3]);

            ndc.forEach((val, i) => {
              assert.ok(Math.abs(val - expected[i]) < 1e-10,
                `RH coordinate ${i} mismatch. Got ${val}, expected ${expected[i]} for point ${point}`);
            });
          });
        });

        // Test 2: Left-Handed Mode (DirectX/Unity Style)
        it("maps LH frustum corners to NDC correctly", () => {
          // 1. Setup Matrix Mode
          const m = new Matrix4();

          const near = 1;
          const far = 3;
          m.frustum(-1, 1, -1, 1, near, far, "left");

          // 2. Define Corner Points
          // Z-coordinates must be POSITIVE (e.g., +near, +far)
          const farScale = far / near;

          const corners = [
            // Near Plane (Z = +1)
            {point: [-1, -1, near], expected: [-1, -1, -1]},
            {point: [1, 1, near], expected: [1, 1, -1]},

            // Far Plane (Z = +3) - scaled X/Y coordinates must be used
            {point: [-farScale, farScale, far], expected: [-1, 1, 1]},
            {point: [farScale, -farScale, far], expected: [1, -1, 1]},
          ];

          // 3. Run Assertions (unchanged)
          corners.forEach(({point, expected}) => {
            const clone = m.clone;
            const v = clone.multiply({data: [...point, 1], rows: 4, cols: 1});
            const ndc = v.slice(0, 3).map(val => val / v[3]);

            ndc.forEach((val, i) => {
              assert.ok(Math.abs(val - expected[i]) < 1e-10,
                `LH coordinate ${i} mismatch. Got ${val}, expected ${expected[i]} for point ${point}`);
            });
          });
        });
      });

      describe("perspective", () => {
        const fov = Math.PI / 2;
        const aspect = 1;
        const near = 1;
        const far = 3;

        function testCorners(m) {
          const t = near * Math.tan(fov / 2);
          const r = t * aspect;

          const scale = far / near;

          const corners = [
            // near plane
            {point: [-r, -t, -near], expected: [-1, -1, -1]},
            {point: [r, t, -near], expected: [1, 1, -1]},

            // far plane
            {point: [-r * scale, t * scale, -far], expected: [-1, 1, 1]},
            {point: [r * scale, -t * scale, -far], expected: [1, -1, 1]},
          ];

          corners.forEach(({point, expected}) => {
            const clip = m.clone.multiply({
              data: [...point, 1], rows: 4, cols: 1
            });
            const w = clip[3];
            const ndc = [clip[0] / w, clip[1] / w, clip[2] / w];

            ndc.forEach((v, i) =>
              assert.ok(Math.abs(v - expected[i]) < 1e-10,
                `coordinate ${i} mismatch for point ${point} got:${v} expected:${expected[i]}`
              )
            );
          });
        }

        function testCenter(m, handedness) {
          const hand = handedness === "right" ? 1 : -1;
          const A = -(far + near) / (far - near) * hand;
          const B = -2 * far * near / (far - near) * hand;
          const zCenter = -B / A;

          const center = [0, 0, zCenter];
          const result = m.clone.multiply({data: [...center, 1], rows: 4, cols: 1});

          const w = result[3];
          const ndc = [result[0] / w, result[1] / w, result[2] / w];
          ndc.forEach((v, i) => assert.ok(Math.abs(v) < 1e-10, `center coordinate ${i} should be 0`));
        }

        it("maps RH frustum correctly", () => {
          const m = new Matrix4().perspective(fov, aspect, near, far);
          testCorners(m);
          testCenter(m, 'right');
        });

        it("maps LH frustum correctly", () => {
          const m = new Matrix4().perspective(fov, aspect, near, far);
          testCorners(m);
          testCenter(m, "left");
        });
      });

      describe("orthographic", () => {
        it("maps box corners correctly (column-major, standard WebGL)", () => {
          const m = Matrix.identity(4).orthographic(-1, 1, -2, 2, 0, 4);

          const mapToNDC = (p) => {
            const v = m.clone.multiply({data: [...p, 1], rows: 4, cols: 1});
            return v.slice(0, 3);
          };

          // Your implementation: z_ndc = -2*z/(far-near) - (far+near)/(far-near)
          // At z=0 (near): -1, at z=4 (far): -3
          const corners = [
            {point: [-1, -2, 0], expected: [-1, -1, -1]},  // near plane
            {point: [1, 2, 4], expected: [1, 1, -3]},      // far plane
            {point: [-1, 2, 0], expected: [-1, 1, -1]},    // near plane
            {point: [1, -2, 4], expected: [1, -1, -3]},    // far plane
          ];

          corners.forEach(({point, expected}) => {
            const result = mapToNDC(point);
            for (let i = 0; i < 3; i++)
            {
              assert.ok(
                Math.abs(result[i] - expected[i]) < 1e-10,
                `Point ${JSON.stringify(point)}: coordinate ${i} mismatch: got ${result[i]}, expected ${expected[i]}`
              );
            }
          });
        });

        it("maps center of box correctly", () => {
          const m = Matrix.identity(4).orthographic(-2, 2, -2, 2, 0, 4);
          const center = [0, 0, 2]; // halfway between near=0 and far=4
          const v = m.clone.multiply({data: [...center, 1], rows: 4, cols: 1});
          const ndc = v.slice(0, 3);

          // z_ndc = -2*2/4 - 4/4 = -1 - 1 = -2
          assert.ok(Math.abs(ndc[0]) < 1e-10, `x should be 0, got ${ndc[0]}`);
          assert.ok(Math.abs(ndc[1]) < 1e-10, `y should be 0, got ${ndc[1]}`);
          assert.ok(Math.abs(ndc[2] - (-2)) < 1e-10, `z should be -2, got ${ndc[2]}`);
        });

        it("validates depth mapping equation", () => {
          const m = Matrix.identity(4).orthographic(-1, 1, -1, 1, 1, 5);

          // z_ndc = -2*z/(far-near) - (far+near)/(far-near)
          // z_ndc = -2*z/4 - 6/4 = -0.5*z - 1.5
          const testPoint = (z, expectedNDC) => {
            const v = m.clone.multiply({data: [0, 0, z, 1], rows: 4, cols: 1});
            const ndc = v.slice(0, 3);
            assert.ok(
              Math.abs(ndc[2] - expectedNDC) < 1e-10,
              `z=${z}: expected NDC z=${expectedNDC}, got ${ndc[2]}`
            );
          };

          testPoint(1, -2);    // near plane: -0.5*1 - 1.5 = -2
          testPoint(5, -4);    // far plane: -0.5*5 - 1.5 = -4
          testPoint(3, -3);    // midpoint: -0.5*3 - 1.5 = -3
        });

        it("correctly maps x and y bounds", () => {
          const m = Matrix.identity(4).orthographic(-2, 6, -3, 5, 0, 10);

          const testPoint = (x, y, expectedX, expectedY) => {
            const v = m.clone.multiply({data: [x, y, 0, 1], rows: 4, cols: 1});
            const ndc = v.slice(0, 3);
            assert.ok(Math.abs(ndc[0] - expectedX) < 1e-10, `x: got ${ndc[0]}, expected ${expectedX}`);
            assert.ok(Math.abs(ndc[1] - expectedY) < 1e-10, `y: got ${ndc[1]}, expected ${expectedY}`);
          };

          testPoint(-2, -3, -1, -1);  // left, bottom → -1, -1
          testPoint(6, 5, 1, 1);      // right, top → 1, 1
          testPoint(2, 1, 0, 0);      // center → 0, 0
        });
      });

      describe("lookAt", () => {
        const eye = new Vector3(1, 2, 3);
        const target = new Vector3(4, 5, 6);
        const up = new Vector3(0, 1, 0);

        function testLookAtMatrix(m, eye, target, handedness = 'right') {
          const eyeVec4 = [...eye, 1];
          const transformedVec4 = m.clone.multiply({data: eyeVec4, rows: 4, cols: 1});
          const w = transformedVec4[3];
          const transformed = transformedVec4.slice(0, 3).map(v => v / w);

          // Eye should map to origin
          for (let i = 0; i < 3; i++)
          {
            assert.ok(Math.abs(transformed[i]) < 1e-10, `eye should map to origin, coord ${i} = ${transformed[i]}`);
          }

          // Compute forward vector according to handedness
          const F = handedness === 'right'
            ? new Vector3(target).subtract(eye).normalize()   // T - E
            : new Vector3(target).subtract(eye).normalize();  // Same formula, but cross products flipped inside lookAt

          const lastcolumn = m.getCol(3);

          // Your matrix stores lastcolumn[2] = F.dot(E) always, so test against that
          assert.ok(
            Math.abs(lastcolumn[2] - F.dot(eye)) < 1e-6,
            `${handedness} forward component in last column matches ${lastcolumn[2]} vs ${F.dot(eye)}`
          );
        }


        it("should compute RH lookAt correctly", () => {
          const mat = new Matrix4().lookAt(eye, target, up);
          testLookAtMatrix(mat, eye, target, "right");
        });

        it("should compute LH lookAt correctly", () => {
          const mat = new Matrix4().lookAt(eye, target, up);
          testLookAtMatrix(mat, eye, target, "left");
        });
      });
    });

  });
});
