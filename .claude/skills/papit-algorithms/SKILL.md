---
name: papit-algorithms
description: Conventions for packages/algorithms (@papit/data-structure, @papit/deep-merge, @papit/vector, @papit/matrix, and the geometry/intersection math). Covers pure, allocation-aware, fully tested library code with node:test, correctness-first testing (edge cases, invariants, numeric tolerance), and complexity documentation. Load for any algorithms work.
---

# Algorithms

Load `papit-global` first.

## Packages
```
packages/algorithms/data-structure        stack, queue, priority-queue, linked-list, tree, binary-search-tree, graph
packages/algorithms/deep-merge            deep object merge (last wins)
packages/algorithms/math/algebra/vector   Vector (N-dim, Float32Array), Vector2, Vector3
packages/algorithms/math/algebra/matrix   column-major Matrix, Matrix3, Matrix4 (transforms, projection, inversion)
```
Geometry and intersection (`math/geometry/*`, `math/intersection/*`) each get their own `@papit/*` package under `math/`, mirroring `algebra/`.

## Principles
- **Pure and deterministic.** No DOM, no I/O, no globals. Works in node and browser (`papit.type: "node"`).
- **From scratch.** These packages exist so nothing else needs a math or collections dependency.
- **Performance-aware API.** Offer mutating (allocation-free) and functional variants where it matters (see matrix). Typed arrays for numeric data.
- **Correctness first.** A fast wrong answer is a bug. Handle degenerate input explicitly: empty collections, zero vectors, singular matrices, collinear points, parallel lines.

## Testing (node:test)
TDD like everywhere, and these packages should be the best-tested in the repo. For each public operation:
- the normal case, with hand-verified expected values
- edge cases: empty/single element, zero, negative, NaN/Infinity where reachable, dimension mismatch
- invariants and round-trips: `M · M⁻¹ = I`, `normalize(v).magnitude === 1`, push→pop order, heap order after random inserts
- floats: compare with a tolerance helper, never `strictEqual` on computed floats
- mutating vs functional variants give the same result, and the functional one doesn't mutate its input

References: `math/algebra/matrix/tests` (56 tests), `data-structure/tests` (one file per structure).

Current gap: `deep-merge` has only the scaffold stub. Cover arrays, nested objects, `null`/`undefined`, class instances and prototype-pollution keys (`__proto__`, `constructor`).

## Docs
Follow `papit-documentation`. Algorithm READMEs also state:
- the **complexity** of each non-trivial operation (a table: operation, time, space)
- conventions that bite: column-major storage, handedness, angle units (radians), mutating vs returning new

JSDoc on each public method with `@returns` when the result isn't obvious, and `@throws` for invalid input.
