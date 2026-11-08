# @papit/game-mesh

Mesh data for games: a typed-array mesh, a builder for primitive shapes, WebGL upload and a glTF loader.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/game-mesh.svg?logo=npm)](https://www.npmjs.com/package/@papit/game-mesh)

---

# Installation

```bash
npm install @papit/game-mesh
```

# Usage

```js
import { MeshBuilder, upload } from "@papit/game-mesh";

const tree = new MeshBuilder()
    .cylinder("#7a4b2a", { scale: [.3, 1, .3] }, 6)
    .cone("#3f8f3a", { at: [0, .8, 0], scale: [1.2, 1.4, 1.2] }, 7)
    .build();                        // flat normals, or build({ smooth: true })

const gpu = upload(gl, tree);        // WebGL2 VAO, attributes at ATTRIBUTES
gpu.draw();
gpu.destroy();
```

glTF and skins:

```js
import { loadGLTF, rig, SKINNING_GLSL } from "@papit/game-mesh";

const gltf = await loadGLTF("hero.glb");
const body = gltf.meshes[0].primitives[0];
const skeleton = rig(gltf);          // an @papit/armature rig

skeleton.bones[3].rotation.setAxisAngle(0, 0, 1, .5);
skeleton.armature.update();
gl.uniformMatrix4fv(jointsLocation, false, skeleton.update());
```

# API

## Mesh

```ts
type Mesh = {
    positions: Float32Array;   // xyz
    normals: Float32Array;     // xyz
    colors?: Float32Array;     // rgba
    uvs?: Float32Array;
    indices?: Uint16Array | Uint32Array;
    joints?: Uint16Array; weights?: Float32Array;   // 4 per vertex
    bounds: { min; max; radius };
};
```

`bounds(positions)`: axis-aligned bounds and the radius around the origin.

## MeshBuilder

| Method | Shape |
| --- | --- |
| `triangle(a, b, c, colour?)`, `quad(a, b, c, d, colour?)` | raw faces, counter clockwise |
| `plane(colour?, place?)` | 1 by 1 in xz, facing +y |
| `box(colour?, place?)` | size 1 around its centre |
| `cylinder(colour?, place?, sides?, bottom?, top?, caps?)` | y 0 to 1, a top of 0 is a cone |
| `cone(colour?, place?, sides?, radius?, caps?)` | |
| `sphere(colour \| (point) => colour, place?, detail?)` | radius 1 icosphere, `20 * 4^detail` triangles |
| `add(mesh \| builder, place?)` | another mesh, placed |
| `build({ smooth? })` | flat: one normal per triangle. Smooth: welded, averaged normals, indexed |

`Place`: `{ at?, yaw?, pitch?, roll?, scale? }`. Colours are hex strings or 0..1 `[r, g, b, a?]`.

## upload

`upload(gl, mesh)` returns `{ vao, count, indexType, draw(), destroy() }`. Locations: `ATTRIBUTES = { position: 0, normal: 1, color: 2, uv: 3, joints: 4, weights: 5 }`.

## glTF

`loadGLTF(url, options?)`, `parseGLTF(buffer | json, options?)`: glTF 2.0, `.glb` and `.gltf` (data uris or `options.load`). Returns `{ meshes: { primitives: Mesh[] }[], nodes, skins, roots, animations }`. Triangle primitives only; colour is `COLOR_0` times the base colour; missing normals are computed.

## Skins

`rig(gltf, skin?)` returns `{ armature, bones, matrices, update() }`. `update()` writes `bone.worldMatrix * inverseBind` per joint. `SKINNING_GLSL` declares `joints`, `weights`, `jointMatrices[64]` and `skinMatrix()`.

## Animations

`gltf.animations`: `{ name, duration, channels }`, each channel `{ node, path, interpolation, times, values }`. `sample(animation, time, rig, loop?)` writes translations to `bone.offset` and rotations to `bone.rotation` (LINEAR slerp, STEP, CUBICSPLINE), then call `rig.armature.update()`. `sampleChannel(channel, time, size, out)` for one channel.

```js
sample(gltf.animations[0], time, skeleton);
skeleton.armature.update();
```

# Design notes

- Data only; drawing belongs to whoever draws.
- `views/`: builder shapes, Suzanne from Blender, a skinned tentacle (animation, bend by hand, weight colours). Models are made by `views/suzanne/public/models/make.py` (`blender -b -P make.py`).
- glTF is the only file format: it's the web standard and Blender exports it.
- Not supported: textures, materials beyond base colour, sparse accessors, morph target weights, node scale in rigs and animations.

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

- [`@papit/armature`](https://www.npmjs.com/package/@papit/armature): rigs for skins
- [`@papit/game-engine`](https://www.npmjs.com/package/@papit/game-engine): rendering
