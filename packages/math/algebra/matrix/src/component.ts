import { Vector, Vector3, VectorValue } from "@papit/vector";
import { isMatrixObject, isNestedArray, toMatrix } from "./helper";
import { Value, MatrixObject } from "./types";

export class Matrix extends Float32Array {
  rows: number = 0;
  cols: number = 0;

  constructor(matrix: MatrixObject);
  constructor(size: number);
  constructor(size: number, identity: boolean);
  constructor(rows: number, cols: number);
  constructor(value: number, rows: number, cols: number);
  constructor(data: Float32Array | number[] | number[][]);
  constructor(data: Float32Array | number[], rows: number, cols: number);
  constructor(a: Value, b?: number | boolean, c?: number) {
    const coerced = Matrix.Coerced(a, b, c);

    super(coerced.data);

    this.rows = coerced.rows;
    this.cols = coerced.cols;
  }

  static create(a: Value, b?: number | boolean, c?: number) {
    return new this(a as any, b as any, c as any);
  }

  protected getIndex(row: number, col: number) {
    return col * this.rows + row;
  }

  public get(row: number, col?: number) {
    if (col === undefined) 
    {
      // return by index
      return this[row];
    }

    return this[this.getIndex(row, col)];
  }
  public getRow(row: number) {
    if (row < 0 || row >= this.rows) throw new Error("out of boundary");

    const columns = new Float32Array(this.cols);
    for (let i = 0; i < this.cols; i++)
    {
      columns[i] = this[this.getIndex(row, i)];
    }
    return new Vector(columns);
  }
  public getCol(col: number) {
    if (col < 0 || col >= this.cols) throw new Error("out of boundary");

    const start = col * this.rows;
    const rows = new Float32Array(this.rows);
    for (let i = 0; i < this.rows; i++)
    {
      rows[i] = this[start + i];
    }

    return new Vector(rows);
  }
  public add(value: Value) {

    if (typeof value === "number") 
    {
      for (let i = 0; i < this.length; i++)
      {
        this[i] += value;
      }
      return this;
    }

    const normalized = Matrix.coerce(value);
    const data = normalized instanceof Matrix ? normalized : normalized.data;

    if (data.length !== this.length) console.warn("[matrix] add - size missmatch");
    for (let i = 0; i < this.length; i++)
    {
      this[i] += data[i % data.length];
    }

    return this;
  }
  public multiply(value: Value) {

    if (typeof value === "number")
    {
      for (let i = 0; i < this.length; i++) this[i] *= value;
      return this;
    }

    const other = Matrix.coerce(value);
    const data = other instanceof Matrix ? other : other.data;

    if (this.cols !== other.rows)
    {
      throw new Error(`Matrix dimension mismatch A.cols x B.rows: (${this.cols} x ${other.rows})`);
    }

    const R = this.rows;
    const C = this.cols;
    const M = other.cols;

    const out = new Float32Array(R * M);

    // ---- COLUMN-MAJOR VERSION ----
    for (let c = 0; c < M; c++) // each output col
    {
      for (let r = 0; r < R; r++) // each output row
      {
        let sum = 0;

        for (let k = 0; k < C; k++) // shared dimension
        {
          const a = this[k * R + r];     // A(r,k)
          const b = data[c * C + k];     // B(k,c)
          sum += a * b;
        }

        out[c * R + r] = sum;            // store column-major
      }
    }

    // mutate this:
    this.set(out);
    this.cols = M;

    return this;
  }
  public transpose() {
    const out = new Float32Array(this.length);

    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        out[c * this.rows + r] = this[r + c * this.rows];

    this.set(out);
    [this.rows, this.cols] = [this.cols, this.rows];
    return this;
  }
  public get clone(): this {
    // @ts-expect-error TS does not fully understand this dynamic constructor
    return new (this.constructor as { new(values: Value): this })(this.slice(), this.rows, this.cols);
  }

  slice(): Float32Array<ArrayBuffer>;
  slice(start: number, end: number): Float32Array<ArrayBuffer>;
  public slice(start?: number, end?: number): Float32Array<ArrayBuffer> {
    const s = start || 0;
    const e = end || this.length;
    const diff = e - s;

    const data = new Float32Array(diff);
    for (let i = 0; i < diff; i++)
    {
      data[i] = this[i + s];
    }

    return data;
  }

  public print() {
    const rows = [];
    for (let i = 0; i < this.rows; i++)
    {
      rows.push(Array.from(this.getRow(i)));
    }

    console.log(`Matrix (${this.rows},${this.cols})`);
    console.table(rows);
  }

  // static 
  static identity(size: 3): Matrix3;
  static identity(size: 4): Matrix4;
  static identity(size: number): MatrixN;
  static identity(size: number) {
    if (size === 4) return new Matrix4();
    if (size === 3) return new Matrix3();

    return new MatrixN(size);
  }

  static coerce<T extends Matrix = Matrix>(value: Value) {
    if (value instanceof this) return value as T;
    return toMatrix(value);
  }

  private static Coerced(a: Value, b?: number | boolean, c?: number) {

    if (typeof b === "boolean")
    {
      if (!(typeof a === "number" && b)) throw new Error("identity must have a size");

      b = a;
      c = a;
      a = new Array(b * b).fill(0);
      for (let i = 0; i < b; i++)
      {
        a[i * b + i] = 1;
      }

      return toMatrix(a, b, c);
    }

    if (isNestedArray(a) || isMatrixObject(a))
      return toMatrix(a, b, c);

    if (typeof c === "number")
    {
      const rows = Math.max(b!, 1);
      const cols = Math.max(c, 1);

      return toMatrix({
        rows,
        cols,
        data: a,
      });
    }

    if (typeof a === "number")
      return toMatrix({ rows: a, cols: b ?? a, data: 0 });

    return toMatrix(a, b, c);
  }

  static add<T extends typeof Matrix>(this: T, mat: T | Value, value: Value): InstanceType<T> {
    if (mat instanceof Matrix)
    {
      return mat.clone.add(value) as InstanceType<T>;
    }

    return new this(mat as any).add(value) as InstanceType<T>;
  }
  static multiply<T extends typeof Matrix>(this: T, mat: T | Value, value: Value): InstanceType<T> {
    if (mat instanceof Matrix)
    {
      return mat.clone.multiply(value) as InstanceType<T>;
    }

    return new this(mat as any).multiply(value) as InstanceType<T>;
  }
  static transpose<T extends typeof Matrix>(this: T, mat: T | Value): InstanceType<T> {
    if (mat instanceof Matrix)
    {
      return mat.clone.transpose() as InstanceType<T>;
    }

    return new this(mat as any).transpose() as InstanceType<T>;
  }
}

export class MatrixN extends Matrix {

  constructor(size: number);
  constructor(data: number[]);
  constructor(data: Float32Array);
  constructor(value: number | number[] | Float32Array) {
    let size = 1;
    if (typeof value === "number") size = Math.max(value, size);
    else 
    {
      size = Math.sqrt(value.length);
    }

    super(size, true);

    if (typeof value !== "number")
    {
      this.set(value);
    }
  }

  public get size() { return this.cols }

  public identity() {
    for (let i=0; i<this.length; i++)
    {
      this[i] = 0;
    }

    for (let i = 0; i < this.size; i++)
    {
      this[i * this.size + i] = 1;
    }
  }

  public getTranslation() {
    const size = this.cols - 1;
    const output = new Float32Array(size);
    for (let i = 0; i < size; i++)
    {
      output[i] = this.get(i, size);
    }
    return output;
  }
  public getScale(): Float32Array {
    const dim = this.cols - 1;
    const scale = new Float32Array(dim);

    for (let j = 0; j < dim; j++)
    {
      let len2 = 0;
      for (let i = 0; i < dim; i++)
      {
        len2 += this[i + j * this.rows] ** 2;
      }
      scale[j] = Math.sqrt(len2);
    }

    return scale;
  }

  public inverse(mode: "TRS" | "GAUSSIAN" = "TRS"): this {
    if (mode === "TRS") return this.inverseTRS();

    console.warn("Gaussian elimination is not yet implemented");
    return this;
  }

  public inverseTRS(): this {
    const dim = this.cols - 1;

    // 1️⃣ extract scale using getScale() and normalize rotation columns
    const scale = this.getScale(); // returns actual scale along each column

    for (let j = 0; j < dim; j++)
    {
      const s = scale[j];
      scale[j] = s > 1e-12 ? 1 / s : 1; // inverse scale for normalization

      // normalize column to isolate rotation
      for (let i = 0; i < dim; i++)
      {
        this[i + j * this.rows] /= s || 1;
      }
    }

    // 2️⃣ transpose rotation block
    for (let r = 0; r < dim; r++)
    {
      for (let c = r + 1; c < dim; c++)
      {
        const a = r + c * this.rows;
        const b = c + r * this.rows;

        const tmp = this[a];
        this[a] = this[b];
        this[b] = tmp;
      }
    }

    // 3️⃣ apply inverse scale along transposed rows (correct axes)
    for (let r = 0; r < dim; r++)
    {
      for (let c = 0; c < dim; c++)
      {
        this[r + c * this.rows] *= scale[r];
      }
    }

    // 4️⃣ invert translation using full rotation*scale inverse
    const invTranslation = new Float32Array(dim);
    for (let i = 0; i < dim; i++)
    {
      let sum = 0;
      for (let j = 0; j < dim; j++)
      {
        sum -= this[j + dim * this.rows] * this[i + j * this.rows];
      }
      invTranslation[i] = sum;
    }

    for (let i = 0; i < dim; i++)
    {
      this[i + dim * this.rows] = invTranslation[i];
      this[dim + i * this.rows] = i === dim ? 1 : 0; // fix bottom row
    }

    return this;
  }

  translate(values: number[] | Float32Array): this;
  translate(...values: number[]): this;
  public translate(v: number | number[] | Float32Array, ...rest: number[]): this {
    const values = Array.isArray(v) ? v : v instanceof Float32Array ? v : [v, ...rest];

    if (values.length !== this.size - 1)
    {
      throw new Error("Translation vector must match dimension - 1");
    }

    const m = Matrix.identity(this.size);
    for (let i = 0; i < values.length; i++)
    {
      m[m.getIndex(i, this.size - 1)] = values[i];
    }

    return this.multiply(m);
  }

  public rotate(angle: number, axis: number[] = [], handedness: 'right' | 'left' = 'right'): this {

    if (this.size < 2) throw new Error("Minimum dimension required is 2");

    const hand = handedness === "right" ? 1 : -1;
    const c = Math.cos(angle);
    const s = Math.sin(angle) * hand;
    const [a = 0, b = 1] = axis;

    // Start with identity data
    const data = (this.constructor as any).identity(this.size);

    // Apply 2x2 rotation block
    data[a + a * this.rows] = c;
    data[b + b * this.rows] = c;
    data[a + b * this.rows] = -s;
    data[b + a * this.rows] = s;

    return this.multiply(data);
  }

  scale(values: number[] | Float32Array): this;
  scale(...values: number[]): this;
  public scale(v: number | number[] | Float32Array, ...rest: number[]): this {
    const values = Array.isArray(v) ? v : v instanceof Float32Array ? v : [v, ...rest];
    const m = Matrix.identity(this.size);

    for (let i = 0; i < this.size - 1; i++)
    {
      const idx = i * this.size + i; // diagonal index
      m[idx] = values[i % values.length];
    }

    return this.multiply(m);
  }

  static inverse<T extends typeof MatrixN>(this: T, mat: T | Value, ...args: Parameters<InstanceType<T>['inverse']>): InstanceType<T> {
    if (mat instanceof MatrixN)
    {
      return mat.clone.inverse(...args) as InstanceType<T>;
    }

    return new this(mat as any).inverse(...args) as InstanceType<T>;
  }
  static scale<T extends typeof MatrixN>(this: T, mat: T | Value, ...args: Parameters<InstanceType<T>['scale']>): InstanceType<T> {
    if (mat instanceof MatrixN)
    {
      return mat.clone.scale(...args) as InstanceType<T>;
    }

    return new this(mat as any).scale(...args) as InstanceType<T>;
  }
  static translate<T extends typeof MatrixN>(this: T, mat: T | Value, ...args: Parameters<InstanceType<T>['translate']>): InstanceType<T> {
    if (mat instanceof MatrixN)
    {
      return mat.clone.translate(...args) as InstanceType<T>;
    }

    return new this(mat as any).translate(...args) as InstanceType<T>;
  }
  static rotate<T extends typeof MatrixN>(this: T, mat: T | Value, angle: number, axis: number[] = []): InstanceType<T> {
    if (mat instanceof MatrixN)
    {
      return mat.clone.rotate(angle, axis) as InstanceType<T>;
    }

    return new this(mat as any).rotate(angle, axis) as InstanceType<T>;
  }
  static override create(value: number | number[] | Float32Array) {
    return new this(value as any);
  }
}

export class Matrix3 extends MatrixN {
  constructor();
  constructor(data: Float32Array);
  constructor(data: number[]);
  constructor(data: number | Float32Array | number[] = 3) {
    super(data as any);

    this.cols = 3;
    this.rows = 3;
  }

  public override rotate(angle: number): this {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return this.multiply({
      rows: 3,
      cols: 3,
      data: [
        c, s, 0,
        -s, c, 0,
        0, 0, 1
      ]
    });
  }

  static override create(value: number | number[] | Float32Array = 3) {
    return new this(value as any);
  }


  // static rotate<T extends typeof Matrix3>(this: T, mat: T, angle: number): InstanceType<T> {
  //   if (mat instanceof Matrix3)
  //   {
  //     return mat.clone.rotateX(angle) as InstanceType<T>;
  //   }

  //   return new this(mat as any).rotateX(angle) as InstanceType<T>;
  // }
}

export class Matrix4 extends MatrixN {
  constructor();
  constructor(data: Float32Array);
  constructor(data: number[]);
  constructor(data: number | Float32Array | number[] = 4) {
    super(data as any);

    this.cols = 4;
    this.rows = 4;
  }

  static override create(value: number | number[] | Float32Array = 4) {
    return new this(value as any);
  }

  // rotations 
  static rotationX(angle: number, handedness: "right" | "left" = "right") {
    const hand = handedness == "right" ? 1 : -1;
    const c = Math.cos(angle);
    const s = Math.sin(angle) * hand;

    return new Matrix4([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    ]);
  }
  static rotationY(angle: number, handedness: "right" | "left" = "right") {
    const hand = handedness == "right" ? 1 : -1;
    const c = Math.cos(angle);
    const s = Math.sin(angle) * hand;

    return new Matrix4([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }
  static rotationZ(angle: number, handedness: "right" | "left" = "right") {
    const hand = handedness == "right" ? 1 : -1;
    const c = Math.cos(angle);
    const s = Math.sin(angle) * hand;

    return new Matrix4([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  public rotateX(angle: number, handedness: 'right' | 'left' = 'right') {
    return this.multiply(Matrix4.rotationX(angle, handedness));
  }

  public rotateY(angle: number, handedness: 'right' | 'left' = 'right') {
    return this.multiply(Matrix4.rotationY(angle, handedness));
  }

  public rotateZ(angle: number, handedness: 'right' | 'left' = 'right') {
    return this.multiply(Matrix4.rotationZ(angle, handedness));
  }

  /**
   * Creates a perspective projection matrix from explicit frustum bounds.
   *
   * @param {number} left  - Left plane of the frustum.
   * @param {number} right - Right plane of the frustum.
   * @param {number} bottom - Bottom plane of the frustum.
   * @param {number} top    - Top plane of the frustum.
   * @param {number} near   - Distance to the near clipping plane (must be > 0).
   * @param {number} far    - Distance to the far clipping plane (must be > near).
   * @returns {Matrix} A 4×4 projection matrix mapping the specified frustum
   *                   into clip space.
   *
   * @description
   * This is the low-level version of perspective projection.
   * `perspective(fov, aspect, near, far)` is just a convenience wrapper that
   * computes `left, right, top, bottom` and then calls `frustum(...)`.
   */
  public frustum(left: number, right: number, bottom: number, top: number, near: number, far: number, handedness: 'right' | 'left' = 'right'): this {
    const rl = 1 / (right - left);
    const tb = 1 / (top - bottom);
    const fn = 1 / (far - near);

    const hand = handedness === "right" ? 1 : -1;

    this.set([
      2 * near * rl, 0, 0, 0, // column 1
      0, 2 * near * tb, 0, 0, // column 2
      (right + left) * rl, (top + bottom) * tb, -(far + near) * fn * hand, -1 * hand, // column 3
      0, 0, -2 * far * near * fn, 0, // column 4
    ]);

    return this;
  }

  /**
   * Sets this matrix to a perspective projection.
   *
   * This is a wrapper around `frustum()` for symmetric frustums.
   *
   * @param {number} fovY - Vertical field of view in radians.
   * @param {number} aspect - Aspect ratio of the viewport (width / height).
   * @param {number} near - Distance to the near clipping plane (must be > 0).
   * @param {number} far - Distance to the far clipping plane (must be > near).
   * @returns {this} Returns this matrix for chaining.
   *
   * @example
   * ```
   * const m = new Matrix4();
   * m.perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 100);
   * ```
   */
  public perspective(fovY: number, aspect: number, near: number, far: number): this {
    // 1. Compute the top/bottom/left/right of the near plane
    const t = near * Math.tan(fovY / 2);
    const b = -t;

    const r = t * aspect;
    const l = -r;

    // 2. Use your frustum() function
    return this.frustum(l, r, b, t, near, far);
  }

  /**
   * Applies an orthographic projection to this matrix.
   * 
   * Maps a rectangular box in 3D space to normalized device coordinates (NDC) [-1, 1].
   * This projection is linear (no perspective), so objects do not get smaller with distance.
   *
   * @param left   The minimum x-coordinate of the view box (left side of the box)
   * @param right  The maximum x-coordinate of the view box (right side of the box)
   * @param bottom The minimum y-coordinate of the view box (bottom side of the box)
   * @param top    The maximum y-coordinate of the view box (top side of the box)
   * @param near   The minimum z-coordinate of the view box (nearest plane to camera)
   * @param far    The maximum z-coordinate of the view box (farthest plane from camera)
   * @returns      A new Matrix4 that is this matrix multiplied by the orthographic projection
   *
   * Example:
   * ```
   * const m = Matrix.identity(4);
   * m.orthographic(-1, 1, -1, 1, 0, 10);
   * ```
   */
  public orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number) {
    const lr = 1 / (right - left);
    const bt = 1 / (top - bottom);
    const nf = 1 / (far - near); // note: negative for standard WebGL depth

    const mat = new Matrix4();

    mat[0] = 2 * lr;                  // m00
    mat[5] = 2 * bt;                  // m11
    mat[10] = -2 * nf;                // m22

    mat[12] = -(right + left) * lr;   // m03
    mat[13] = -(top + bottom) * bt;   // m13
    mat[14] = -(far + near) * nf;     // m23

    return this.multiply(mat);
  }

  public lookAt(eye: VectorValue, target: VectorValue, up: VectorValue, handedness: 'right' | 'left' = 'right'): this {
    const E = new Vector3(eye);
    const T = new Vector3(target);
    const U = new Vector3(up);

    const F = T.subtract(E).normalize();

    let R, U2;
    if (handedness === 'right')
    {
      R = Vector3.cross(F, U).normalize();
      U2 = Vector3.cross(R, F);
    } else
    {
      R = Vector3.cross(U, F).normalize();
      U2 = Vector3.cross(F, R);
    }

    this.set([
      R.x, U2.x, -F.x, 0,
      R.y, U2.y, -F.y, 0,
      R.z, U2.z, -F.z, 0,
      -R.dot(E), -U2.dot(E), F.dot(E), 1
    ]);

    return this;
  }

  static RodriguesRotation(angle: number, x: number = 0, y: number = 0, z: number = 1) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    // --- canonical axes optimization ---
    // if rotation around X, Y, or Z, just modify 2x2 plane in-place
    if ((x === 1 && y === 0 && z === 0) ||
      (x === 0 && y === 1 && z === 0) ||
      (x === 0 && y === 0 && z === 1)) 
    {
      let a: number, b: number;

      if (x === 1) [a, b] = [1, 2];       // X axis rotates YZ plane
      else if (y === 1) [a, b] = [0, 2];  // Y axis rotates XZ plane
      else[a, b] = [0, 1];               // Z axis rotates XY plane

      const rot = new Matrix4(); // copy current matrix
      const size = 4;

      // 2x2 plane update
      const ai = a * size + a, aj = a * size + b;
      const bi = b * size + a, bj = b * size + b;

      const aa = rot[ai], ab = rot[aj], ba = rot[bi], bb = rot[bj];

      rot[ai] = c * aa - s * ba;
      rot[aj] = c * ab - s * bb;
      rot[bi] = s * aa + c * ba;
      rot[bj] = s * ab + c * bb;

      return rot;
    }

    // --- arbitrary axis case ---
    const len = Math.hypot(x, y, z);
    if (len === 0) throw new Error("Rotation axis cannot be zero");
    const nx = x / len, ny = y / len, nz = z / len;
    const t = 1 - c;

    const rot = new Matrix4();
    rot.set([
      t * nx * nx + c, t * nx * ny - s * nz, t * nx * nz + s * ny, 0,
      t * nx * ny + s * nz, t * ny * ny + c, t * ny * nz - s * nx, 0,
      t * nx * nz - s * ny, t * ny * nz + s * nx, t * nz * nz + c, 0,
      0, 0, 0, 1
    ]);

    return rot;
  }

  // static clone based 

  static rotateX<T extends typeof Matrix4>(this: T, mat: T | Value, angle: number): InstanceType<T> {
    if (mat instanceof Matrix4)
    {
      return mat.clone.rotateX(angle) as InstanceType<T>;
    }

    return new this(mat as any).rotateX(angle) as InstanceType<T>;
  }
  static rotateY<T extends typeof Matrix4>(this: T, mat: T | Value, angle: number): InstanceType<T> {
    if (mat instanceof Matrix4)
    {
      return mat.clone.rotateY(angle) as InstanceType<T>;
    }

    return new this(mat as any).rotateY(angle) as InstanceType<T>;
  }
  static rotateZ<T extends typeof Matrix4>(this: T, mat: T | Value, angle: number): InstanceType<T> {
    if (mat instanceof Matrix4)
    {
      return mat.clone.rotateZ(angle) as InstanceType<T>;
    }

    return new this(mat as any).rotateZ(angle) as InstanceType<T>;
  }
  static frustum<T extends typeof Matrix4>(this: T, mat: T | Value, left: number, right: number, bottom: number, top: number, near: number, far: number): InstanceType<T> {
    if (mat instanceof Matrix4)
    {
      return mat.clone.frustum(left, right, bottom, top, near, far) as InstanceType<T>;
    }

    return new this(mat as any).frustum(left, right, bottom, top, near, far) as InstanceType<T>;
  }
  static perspective<T extends typeof Matrix4>(this: T, mat: T | Value, fovY: number, aspect: number, near: number, far: number): InstanceType<T> {
    if (mat instanceof Matrix4)
    {
      return mat.clone.perspective(fovY, aspect, near, far) as InstanceType<T>;
    }

    return new this(mat as any).perspective(fovY, aspect, near, far) as InstanceType<T>;
  }
  static orthographic<T extends typeof Matrix4>(this: T, mat: T | Value, left: number, right: number, bottom: number, top: number, near: number, far: number): InstanceType<T> {
    if (mat instanceof Matrix4)
    {
      return mat.clone.orthographic(left, right, bottom, top, near, far) as InstanceType<T>;
    }

    return new this(mat as any).orthographic(left, right, bottom, top, near, far) as InstanceType<T>;
  }
  static lookAt<T extends typeof Matrix4>(this: T, mat: T | Value, eye: VectorValue, target: VectorValue, up: VectorValue, handedness: 'right' | 'left' = 'right'): InstanceType<T> {
    if (mat instanceof Matrix4)
    {
      return mat.clone.lookAt(eye, target, up, handedness) as InstanceType<T>;
    }

    return new this(mat as any).lookAt(eye, target, up, handedness) as InstanceType<T>;
  }
}