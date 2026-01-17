import { toArray } from "./helper";
import { Value, VectorObject } from "./types";

export class Vector extends Float32Array {
  constructor(dimension: number);
  constructor(record: VectorObject);
  constructor(values: number[] | Float32Array);
  constructor(...rest: number[]);
  constructor(value: Value);
  constructor(a: Value, ...rest: number[]) {
    super(toArray(a, ...rest));
  }

  public get magnitude() {
    let sum = 0;
    for (let i = 0; i < this.length; i++)
    {
      sum += this[i] * this[i];
    }
    return Math.sqrt(sum);
  }
  public set magnitude(value: number) {
    const mag = this.magnitude;
    if (mag === 0) return;

    const scale = value / mag;
    this.mapThis(v => v * scale);
  }

  // getters
  get x() { return this[0] }
  get y() { return this[1] }
  get z() { return this[2] }
  get w() { return this[3] }
  // colors 
  get r() { return this[0] }
  get g() { return this[1] }
  get b() { return this[2] }
  get a() { return this[3] }

  // setters
  set x(value: number) { this[0] = value }
  set y(value: number) { this[1] = value }
  set z(value: number) { this[2] = value }
  set w(value: number) { this[3] = value }
  // colors
  set r(value: number) { this[0] = value }
  set g(value: number) { this[1] = value }
  set b(value: number) { this[2] = value }
  set a(value: number) { this[3] = value }

  public dot(value: Value) {
    const coerced = Vector.coerce(value);

    let sum = 0;
    for (let i = 0; i < this.length; i++)
    {
      sum += this[i] * coerced[i % coerced.length];
    }
    return sum;
  }
  add(...values: number[]): this;
  add(value: Value): this;
  public add(value: Value, ...rest: number[]): this {
    const coerced = Vector.coerce(value, ...rest);
    return this.mapThis((value, index) => value + coerced[index % coerced.length]);
  }
  subtract(...values: number[]): this;
  subtract(value: Value): this;
  public subtract(value: Value, ...rest: number[]): this {
    const coerced = Vector.coerce(value, ...rest);
    return this.mapThis((value, index) => value - coerced[index % coerced.length]);
  }
  multiply(...values: number[]): this;
  multiply(value: Value): this;
  public multiply(value: Value, ...rest: number[]): this {
    const coerced = Vector.coerce(value, ...rest);
    return this.mapThis((value, index) => value * coerced[index % coerced.length]);
  }
  divide(...values: number[]): this;
  divide(value: Value): this;
  public divide(value: Value, ...rest: number[]): this {
    const coerced = Vector.coerce(value, ...rest);
    return this.mapThis((value, index) => value / coerced[index % coerced.length]);
  }
  public normalize(): this {
    const mag = this.magnitude;
    if (mag === 0) return this;

    return this.mapThis(v => v / mag);
  }
  public get clone(): this {
    // @ts-expect-error TS does not fully understand this dynamic constructor
    return new (this.constructor as { new(values: Value): this })(this);
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
  // public assign(vector: Value, ...rest: number[]) {

  // }

  public override map(callbackfn: (value: number, index: number, array: this) => number): this {
    return this.clone.mapThis((v, i, a) => callbackfn(v, i, a as this));
  }
  public mapThis(callbackfn: (value: number, index: number, array: this) => number): this {
    for (let i = 0; i < this.length; i++)
    {
      this[i] = callbackfn(this[i], i, this);
    }

    return this;
  }

  static distance(a: Value, b: Value) {
    return this.subtract(a, b).magnitude;
  }
  static coerce(value: Value, ...rest: number[]) {
    return toArray(value, ...(typeof value === "number" ? [value] : rest))
  }
  static dot(a: Value, b: Value) {
    return new this(a).dot(b);
  }

  // vector returns 
  static create<T extends typeof Vector>(this: T, value: Value): InstanceType<T> {
    return new this(value) as InstanceType<T>;
  }
  static add<T extends typeof Vector>(this: T, a: Value, b: Value): InstanceType<T> {
    return new this(a).add(b) as InstanceType<T>;
  }
  static subtract<T extends typeof Vector>(this: T, a: Value, b: Value): InstanceType<T> {
    return new this(a).subtract(b) as InstanceType<T>;
  }
  static multiply<T extends typeof Vector>(this: T, a: Value, b: Value): InstanceType<T> {
    return new this(a).multiply(b) as InstanceType<T>;
  }
  static divide<T extends typeof Vector>(this: T, a: Value, b: Value): InstanceType<T> {
    return new this(a).divide(b) as InstanceType<T>;
  }
}

export class Vector2 extends Vector {

  get angle() {
    return Math.atan2(this.y, this.x);
  }
  set angle(value: number) {
    const mag = this.magnitude;
    this.x = Math.cos(value) * mag;
    this.y = Math.sin(value) * mag;
  }

  static perpendicular(a: Value, b: Value, windingorder: "clockwise" | "counter-clockwise" = "clockwise") {
    const aCoerced = Vector2.coerce(a);
    const bCoerced = Vector2.coerce(b);

    if (aCoerced.length < 2) throw new Error("vector dimension missmatch");
    if (bCoerced.length < 2) throw new Error("vector dimension missmatch");

    const delta = {
      x: bCoerced[0] - aCoerced[0],
      y: bCoerced[1] - aCoerced[1],
    }
    if (windingorder === "clockwise") return new Vector2(-delta.y, delta.x);
    return new Vector2(delta.y, -delta.x);
  }
  static cross(a: Value, b: Value) {
    const aCoerced = Vector2.coerce(a);
    const bCoerced = Vector2.coerce(b);

    if (aCoerced.length < 2) throw new Error("vector dimension missmatch");
    if (bCoerced.length < 2) throw new Error("vector dimension missmatch");

    return aCoerced[0] * bCoerced[1] - aCoerced[1] * bCoerced[0];
  }
  static angle(a: Value) {
    return Vector2.create(a).angle;
  }

  static get zero() {
    return new Vector2(2);
  }
}

export class Vector3 extends Vector {

  public rotate(angle: number, plane: number[]) {
    const [plane0 = 0, plane1 = 1] = plane;

    const c = Math.cos(angle);
    const s = Math.sin(angle);

    const x = this[plane0] * c - this[plane1] * s;
    const y = this[plane0] * s + this[plane1] * c;

    this[plane0] = x;
    this[plane1] = y;

    return this;
  }

  public rotateX(angle: number) {
    this.rotate(angle, [1, 2]);
  }

  public rotateY(angle: number) {
    this.rotate(angle, [0, 2]);
  }

  public rotateZ(angle: number) {
    this.rotate(angle, [0, 1]);
  }


  public cross(v: Value) {
    const coerced = Vector3.coerce(v);
    if (coerced.length < 3) throw new Error("vector dimension missmatch");

    const x = this[1] * coerced[2] - this[2] * coerced[1];
    const y = this[2] * coerced[0] - this[0] * coerced[2];
    const z = this[0] * coerced[1] - this[1] * coerced[0];

    this[0] = x;
    this[1] = y;
    this[2] = z;

    return this;
  }

  static cross(a: Value, b: Value) {
    const aVec = new Vector3(a);
    return aVec.cross(b);
  }

  static get zero() {
    return new Vector3(3);
  }
}