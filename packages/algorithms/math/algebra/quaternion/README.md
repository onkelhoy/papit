# @papit/quaternion

Quaternion math for 3D rotations that compose and blend without gimbal lock. Reach for it when Euler angles fail in cameras, bones or animation.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-math:algebra-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/quaternion.svg?logo=npm)](https://www.npmjs.com/package/@papit/quaternion)

---

## Installation

```bash
npm install @papit/quaternion
```

## Usage

```js
import { Quaternion } from "@papit/quaternion";

const turn = Quaternion.fromAxisAngle([0, 0, 1], Math.PI / 2);
turn.rotate([1, 0, 0]); // about [0, 1, 0]
```

Combine rotations, `b` runs first:

```js
import { Quaternion } from "@papit/quaternion";

const a = Quaternion.fromAxisAngle([0, 0, 1], .5);
const b = Quaternion.fromAxisAngle([1, 0, 0], .25);

const both = Quaternion.multiplyInto(Quaternion.identity, a, b);
```

Aim one direction at another:

```js
import { Quaternion } from "@papit/quaternion";

const aim = Quaternion.fromTo([1, 0, 0], [0, 3, 4]);
```

Blend two rotations and hand the result to a `Matrix4`:

```js
import { Quaternion } from "@papit/quaternion";
import { Matrix4 } from "@papit/matrix";

const from = Quaternion.identity;
const to = Quaternion.fromAxisAngle([0, 1, 0], 2);

const matrix = from.slerp(to, .5).writeMatrix(new Matrix4(), [10, 0, 0]);
```

## API

### Quaternion

```ts
class Quaternion extends Vector
```

Stored as x, y, z, w in a `Float64Array`. Everything below is O(1). Instance methods change the quaternion and return it, except `rotate` and `writeMatrix`, which return their target.

#### Create

| Member | Purpose |
| --- | --- |
| `Quaternion.identity` | A new quaternion with no rotation. |
| `Quaternion.fromAxisAngle(axis, angle)` | A turn in radians around an axis of any length. |
| `Quaternion.fromTo(from, to)` | The shortest rotation from one direction to another. |
| `identity()` | Resets to no rotation. |
| `setAxisAngle(x, y, z, angle)` | `fromAxisAngle` without allocating. |
| `setFromTo(from, to)` | `fromTo` without allocating. |

#### Combine

| Member | Purpose |
| --- | --- |
| `Quaternion.multiplyInto(out, a, b)` | Writes `a * b`, which applies `b` first. `out` can be `a` or `b`. |
| `conjugate()` | Flips to the inverse, for a unit quaternion. |
| `normalize()` | Scales to length 1. Do this now and then after many products. |
| `rotate(point)` | Rotates a 3D point in place. |
| `unrotate(point)` | Rotates a 3D point in place by the inverse. |
| `integrate(x, y, z, dt)` | Turns by an angular velocity in rad/s over `dt`, for physics steps. |

#### Blend

| Member | Purpose |
| --- | --- |
| `nlerp(target, t)` | Fast blend, the speed isn't constant over large angles. |
| `slerp(target, t)` | Blend at a constant speed. |

Both take the short way round and return a unit quaternion.

#### Output

```ts
writeMatrix(out: Float32Array | Float64Array, position?: ArrayLike<number>)
```

Writes the rotation and position into a column-major 4x4 matrix, such as a `Matrix4`, or straight into a `Float32Array` for WebGL.

### Degenerate input

| Input | Result |
| --- | --- |
| Zero axis or zero vector | The identity |
| Zero quaternion in `normalize` | The identity |
| Opposite directions in `fromTo` | A half turn around a perpendicular axis |

## Design notes

- `rotate`, `conjugate`, `nlerp`, `slerp` and `writeMatrix` expect a unit quaternion, which everything in Create gives you.
- `multiply` and `lerp` are inherited from `Vector` and work per component. Use `multiplyInto` to combine rotations and `nlerp` or `slerp` to blend them.
- Instance methods and `multiplyInto` don't allocate, so they're safe in a frame loop. The static `identity`, `fromAxisAngle` and `fromTo` create a new quaternion.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [@papit/vector](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/math/algebra/vector)
- [@papit/matrix](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/math/algebra/matrix)
