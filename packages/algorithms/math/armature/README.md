# @papit/armature

Bone rig math with forward and inverse kinematics in 3D, which covers 2D too. Reach for it when characters, limbs or tentacles need to reach for things.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-math-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/armature.svg?logo=npm)](https://www.npmjs.com/package/@papit/armature)

---

## Installation

```bash
npm install @papit/armature
```

## Usage

Build a rig, then read where the bones ended up:

```js
import { Armature } from "@papit/armature";

const rig = new Armature();
const upper = rig.add("upper", { length: 40, angle: 1 });
const lower = rig.add("lower", { length: 40, parent: upper });

lower.angle = .5;
rig.update();

lower.tail; // Vector3, the end of the arm
```

Add an IK constraint to a bone, like in Blender. `chain` says how many bones it turns and `pole` which way the joint bends. `[x, y]` is enough in 2D. FK always runs first, then the constraints:

```js
import { Armature } from "@papit/armature";

const rig = new Armature();
const thigh = rig.add("thigh", { length: 40 });
const shin = rig.add("shin", { length: 40, parent: thigh });

const target = [30, 50];
rig.ik(shin, { chain: 2, target, pole: [100, 0] });

rig.update();

target[0] = 20; // move it, the next update follows
rig.update();
```

`target` and `pole` can also be a bone. Parent a pole bone to the hips and it follows the rig, and it can still be moved on its own:

```js
import { Armature } from "@papit/armature";

const rig = new Armature();
const hips = rig.add("hips");
const thigh = rig.add("thigh", { length: 40, parent: hips });
const shin = rig.add("shin", { length: 40, parent: thigh });
const pole = rig.add("pole", { parent: hips, offset: [60, 40] });

rig.ik(shin, { chain: 2, target: [30, 50], pole });
rig.update();
```

`chain` left out goes all the way up to the root, in 3D just the same:

```js
import { Armature } from "@papit/armature";

const rig = new Armature();
const first = rig.add("0", { length: 10 });
const second = rig.add("1", { length: 10, parent: first });
const last = rig.add("2", { length: 10, parent: second });

rig.ik(last, { target: [5, 10, 15] });
rig.update();
```

`free` lets the root move too, so the chain trails behind its target like a snake or a rope:

```js
import { Armature } from "@papit/armature";

const rig = new Armature();
const tail = rig.add("tail", { length: 10 });
const head = rig.add("head", { length: 10, parent: tail });

rig.ik(head, { free: true, target: [40, 0, 0] });
rig.update();
```

Bones can also be made first and handed over, parents first:

```js
import { Armature, Bone } from "@papit/armature";

const hips = new Bone("hips");
const spine = new Bone("spine", { length: 60, parent: hips });

const rig = new Armature([hips, spine]);
```

Attach bones anywhere on a parent, and limit how they turn:

```js
import { Armature } from "@papit/armature";

const rig = new Armature();
const torso = rig.add("torso", { length: 60 });
const arm = rig.add("arm", { length: 38, parent: torso, attach: .8, offset: [0, 4] });
const hand = rig.add("hand", { length: 34, parent: arm, limit: { hinge: [0, 0, 1], min: 0, max: 2.5 } });
```

Draw a picture on a bone inside a `GameObject`, the armature needs nothing else:

```js
import { GameObject } from "@papit/game-engine";

class Rig extends GameObject {
    render({ ctx }) {
        const m = this.hand.worldMatrix;

        ctx.save();
        ctx.transform(m[0], m[1], m[4], m[5], m[12], m[13]);
        ctx.drawImage(this.picture, 0, 0);
        ctx.restore();
    }
}
```

Moving, parenting or mirroring that `GameObject` moves the whole rig, so `scale.x = -1` makes it face the other way.

## API

### Armature

```ts
new Armature(bones?: Bone[])
```

| Member | Purpose |
| --- | --- |
| `add(name, options)` | Creates a bone and adds it. Throws on a duplicate name, a negative length or a parent from elsewhere. |
| `find(name)` | The bone with that name, or `null`. |
| `ik(bone, options)` | Puts an IK constraint on a bone. |
| `removeIK(ik)` | Takes a constraint off. |
| `update()` | Runs FK, then every constraint in the order they were added. Call it once a frame. |
| `bones`, `constraints` | What it holds, parents first. |

### Bone

Create bones with `armature.add` or `new Bone(name, options)`. A bone points along its own +X from `head` to `tail`.

| Option | Default | Description |
| --- | --- | --- |
| `parent` | none | The bone this one moves with. |
| `length` | `0` | Distance from head to tail. |
| `attach` | `1` | Where on the parent the head sits, 0 is its head and 1 its tail. |
| `offset` | `[0, 0, 0]` | Added to the attach point in the parent's space. Without a parent, it's the position. |
| `angle` | `0` | Turn around Z in radians, the 2D way to set `rotation`. |
| `limit` | none | A `BoneLimit`, applied by IK. |

| Member | Purpose |
| --- | --- |
| `length`, `attach`, `offset`, `limit` | The options, change them at any time. |
| `rotation` | The pose you set, a `Quaternion` relative to the parent. IK leaves it alone. |
| `solved` | The rotation in use, `rotation` until IK turns the bone. |
| `angle` | Reads and sets the turn around Z. |
| `head`, `tail` | World points as `Vector3`, the same objects on every read. |
| `worldRotation` | World `Quaternion`. |
| `worldMatrix` | `Matrix4` at `head` with X along the bone. It holds no length. |
| `update()` | Runs FK for this bone and everything under it, without constraints. |
| `pointAt(target)` | Turns the bone at a point and updates everything under it. |
| `moveTo(point)` | Moves the head by changing `offset`. |

World means the armature's own space.

### IK

An IK constraint, made with `armature.ik`. It runs inside `armature.update`.

| Option | Default | Description |
| --- | --- | --- |
| `chain` | `0` | How many bones it turns, counted up from the constrained bone. 0 goes to the root. |
| `target` | none | The point to reach, or a bone. Without one, it does nothing. |
| `pole` | none | A point or bone the joints bend towards, for knees and elbows. |
| `weight` | `1` | How much the result replaces the FK pose, 0 to 1. |
| `iterations` | `10` | The most passes for a chain longer than 2. |
| `tolerance` | `0.01` | How close the tip has to get to stop early. |
| `free` | `false` | The root moves too and the chain trails behind. Stored in `rotation` and `offset`. |

All of these except `chain` are properties you can change at any time. `target` and `pole` are read on every update, so a point can be moved in place and a bone moves with its parent.

| Member | Purpose |
| --- | --- |
| `bone` | The bone that reaches. |
| `bones` | The bones it turns, top first. |
| `tip` | The tail of `bone`. |
| `setPositions(positions)` | Poses the bones from x, y, z per head plus the last tail, like a physics result. Bones keep their length. Stored in `rotation`. |

A chain of 2 is solved exactly with the law of cosines, longer chains use FABRIK.

### BoneLimit

```ts
type BoneLimit =
    | { hinge: Point; min: number; max: number }
    | { cone: number };
```

| Limit | Description |
| --- | --- |
| `hinge` | Only turns around one axis in the parent's space, `[0, 0, 1]` for 2D, between `min` and `max` radians. |
| `cone` | Stays within an angle of the parent's X. |

### Degenerate input

| Input | Result |
| --- | --- |
| Target out of reach | The chain points straight at it |
| Target on the root | No NaN, a chain of 2 folds up |
| Chain straight along its target | It bends towards the pole, or sideways in the XY plane |
| Chain of zero length | Nothing happens |
| `pointAt` a point on the head | Nothing happens |

## Complexity

| Operation | Time | Measured |
| --- | --- | --- |
| FK in `update` | O(bones) | about 4 µs for 100 bones |
| IK, `chain` of 2 | O(bones under it) | about 0.7 µs |
| IK, longer chain | O(bones × iterations) | about 36 µs for 100 bones |
| IK, `free` | O(bones) | about 32 µs for 100 bones |

## Design notes

- **3D only.** 2D is 3D with every rotation around Z and z at 0, so there's no second version to keep in step. 2D input stays in its plane.
- **Pure math.** It has no engine or DOM dependency and doesn't draw. Place the rig with whatever owns it, read `worldMatrix` and draw from that.
- **No bone scale.** It breaks IK. `length` can change at any time, mirror from the outside.
- **FK is the normal flow, IK is added on top.** Set poses and targets, then call `update` once a frame. Add a parent's constraint before a child's.
- **IK doesn't touch your pose.** Each frame starts from `rotation`, so taking a constraint off gives FK back, `weight` is a true blend and a chain can't knot up over time. Only `free` chains build on the last frame.
- **Limits are best effort.** A target the limits can't allow gets as close as it can. A hinge never adds twist, so aim it through the parent's own pose, and give a chain of 2 a pole on the side its hinge allows.
- **No allocations in the frame loop.** IK reuses its own buffers.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [@papit/quaternion](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/math/algebra/quaternion)
- [@papit/vector](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/math/algebra/vector)
- [@papit/matrix](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/math/algebra/matrix)
- [@papit/game-engine](https://github.com/onkelhoy/papit/tree/main/packages/game/engine)
