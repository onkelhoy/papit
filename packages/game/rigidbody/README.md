# @papit/rigidbody

Deterministic rigid body physics for 2D and 3D games: bodies, contacts and an impulse solver over @papit/gjk.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/rigidbody.svg?logo=npm)](https://www.npmjs.com/package/@papit/rigidbody)

---

# Installation

```bash
npm install @papit/rigidbody
```

# Usage

```js
import { World, RigidBody, Plane, Box, Sphere } from "@papit/rigidbody";

const world = new World();
world.add(new RigidBody({ shape: new Plane() }));
const box = world.add(new RigidBody({ shape: new Box(1, 1, 1), mass: 1, position: { x: 0, y: 3, z: 0 } }));

// every frame
world.update(delta);
box.matrix(modelMatrix); // Float32Array(16) for WebGL
```

2D: the same world, locked to the xy plane.

```js
import { World, RigidBody, Circle, Polygon } from "@papit/rigidbody";

const world = new World({ dimensions: 2 });
world.add(new RigidBody({ shape: new Circle(0.5), mass: 1, position: { x: 0, y: 4 } }));
world.add(new RigidBody({ shape: new Polygon([{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]), mass: 2 }));
```

Queries:

```js
const hit = world.raycast({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 });
if (hit) console.log(hit.body, hit.t, hit.point, hit.normal);

const near = world.overlap(new Sphere(2), { x: 0, y: 0, z: 0 });
```

# API

## World

```ts
new World(options?: WorldOptions)
```

| option | type | default | description |
|---|---|---|---|
| `dimensions` | `2 \| 3` | `3` | 2 locks z and rotates only about z |
| `gravity` | `{ x, y, z? }` | `{ x: 0, y: -9.81 }` | |
| `timestep` | `number` | `1/120` | fixed step in seconds |
| `maxSteps` | `number` | `8` | most steps per `update` |
| `iterations` | `number` | `10` | velocity solver passes |
| `allowSleep` | `boolean` | `true` | resting bodies stop simulating |
| `sleepSpeed` | `number` | `0.05` | below this speed a body is resting |
| `sleepTime` | `number` | `0.5` | seconds resting before sleep |

| method | description |
|---|---|
| `add(body)` / `remove(body)` | |
| `update(delta)` | runs as many fixed steps as fit, returns the count |
| `step()` | one fixed step |
| `raycast(origin, direction, maxDistance?)` | closest `RayHit` or `null` |
| `segmentCast(start, end)` | closest `RayHit` on the segment or `null` |
| `overlap(shape, position, rotation?)` | bodies touching the placed shape |
| `contacts` | this step's `Manifold`s |

## RigidBody

```ts
new RigidBody(options?: BodyOptions)
```

| option | default | description |
|---|---|---|
| `shape` | none | what it collides as |
| `mass` | `0` | 0 is static |
| `position`, `rotation`, `velocity`, `angularVelocity` | zero / identity | |
| `friction` | `0.5` | pairs use the geometric mean |
| `restitution` | `0` | pairs use the larger |
| `linearDamping`, `angularDamping` | `0` | per second |
| `kinematic` | `false` | moved by hand, pushes others |

State (`position`, `rotation`, `velocity`, `angularVelocity`) is float64 and writable between steps; call `wake()` after writing to a sleeping body. Methods: `applyForce`, `applyTorque`, `applyImpulse` (all wake it), `matrix(out)`, `bounds(min, max)`.

## Shapes

| shape | dims | |
|---|---|---|
| `Sphere(radius)` / `Circle(radius)` | 3D / 2D | |
| `Box(width, height, depth = 1)` | both | |
| `Capsule(radius, height)` | 3D | along local y |
| `Plane()` | both | static, normal is local +y |
| `Hull(points)` / `Polygon(points)` | 3D / 2D | convex hull of the points |
| `ConvexShape(convex, inertia?)` | both | any `@papit/gjk` `Convex` |

# Design notes

- One 3D solver; 2D is the same world with z and off-axis rotation locked.
- Sweep and prune broad phase, sphere and plane fast paths, GJK + EPA for the rest.
- Sequential impulses with warm-started persistent manifolds, friction and split position correction.
- Fixed step and stable pair order: same input gives bit-identical results.
- No allocations per step in the hot loops; queries allocate their result.

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

# Related

- [`@papit/gjk`](https://www.npmjs.com/package/@papit/gjk): the collision core
- [`@papit/vector`](https://www.npmjs.com/package/@papit/vector), [`@papit/quaternion`](https://www.npmjs.com/package/@papit/quaternion): body state
- [`@papit/game-engine`](https://www.npmjs.com/package/@papit/game-engine): rendering, see `views/`
