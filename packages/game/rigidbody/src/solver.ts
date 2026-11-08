import { Vector3 } from "@papit/vector";
import type { RigidBody } from "./body";
import type { Manifold, ManifoldPoint } from "./manifold";
import { multiply3 } from "./math";

/** penetration left alone so resting contacts persist */
const SLOP = 0.005;
/** fraction of the remaining penetration fixed per position pass */
const BAUMGARTE = 0.2;
/** most a position pass moves a point */
const MAX_CORRECTION = 0.2;
/** closing speeds below this do not bounce, so resting bodies settle */
const BOUNCE_THRESHOLD = 1;

// scratch
const r = new Vector3(0, 0, 0), s = new Vector3(0, 0, 0), u = new Vector3(0, 0, 0), p = new Vector3(0, 0, 0);

/** Per-point solver data, kept beside the manifold point. */
export type SolverPoint = {
    rA: Vector3;
    rB: Vector3;
    normalMass: number;
    tangentMass1: number;
    tangentMass2: number;
    /** target normal velocity: bounce, or the speed that just closes a gap */
    bias: number;
};

const solverData = new WeakMap<ManifoldPoint, SolverPoint>();

function data(point: ManifoldPoint): SolverPoint {
    let d = solverData.get(point);
    if (!d)
    {
        d = { rA: new Vector3(0, 0, 0), rB: new Vector3(0, 0, 0), normalMass: 0, tangentMass1: 0, tangentMass2: 0, bias: 0 };
        solverData.set(point, d);
    }
    return d;
}

/** `1 / (ma + mb + n·(Ia (ra×n))×ra + n·(Ib (rb×n))×rb)` along the unit direction `n`. */
function effectiveMass(a: RigidBody, b: RigidBody, ra: Vector3, rb: Vector3, n: Vector3): number {
    let k = a.inverseMass + b.inverseMass;
    k += angularTerm(a, ra, n);
    k += angularTerm(b, rb, n);
    return k > 0 ? 1 / k : 0;
}

function angularTerm(body: RigidBody, rv: Vector3, n: Vector3): number {
    cross(rv, n, s);
    multiply3(body.inverseInertia, s.x, s.y, s.z, u);
    cross(u, rv, s);
    return s.x * n.x + s.y * n.y + s.z * n.z;
}

/** `out = a × b` via Vector3.cross, `out` may be `a` */
function cross(a: Vector3, b: Vector3, out: Vector3): Vector3 {
    if (out !== a) out.set(a);
    return out.cross(b);
}

/** relative velocity of b against a at the point, into `out` */
function relativeVelocity(a: RigidBody, b: RigidBody, d: SolverPoint, out: Vector3): Vector3 {
    cross(b.angularVelocity, d.rB, s);
    cross(a.angularVelocity, d.rA, u);
    out.x = b.velocity.x + s.x - a.velocity.x - u.x;
    out.y = b.velocity.y + s.y - a.velocity.y - u.y;
    out.z = b.velocity.z + s.z - a.velocity.z - u.z;
    return out;
}

/** Applies impulse `scale * direction` to b and its opposite to a. */
function applyImpulse(a: RigidBody, b: RigidBody, d: SolverPoint, direction: Vector3, scale: number) {
    const x = direction.x * scale, y = direction.y * scale, z = direction.z * scale;
    a.velocity.x -= x * a.inverseMass; a.velocity.y -= y * a.inverseMass; a.velocity.z -= z * a.inverseMass;
    b.velocity.x += x * b.inverseMass; b.velocity.y += y * b.inverseMass; b.velocity.z += z * b.inverseMass;
    p.x = x; p.y = y; p.z = z;
    cross(d.rA, p, s);
    multiply3(a.inverseInertia, s.x, s.y, s.z, u);
    a.angularVelocity.x -= u.x; a.angularVelocity.y -= u.y; a.angularVelocity.z -= u.z;
    cross(d.rB, p, s);
    multiply3(b.inverseInertia, s.x, s.y, s.z, u);
    b.angularVelocity.x += u.x; b.angularVelocity.y += u.y; b.angularVelocity.z += u.z;
}

/** Friction directions perpendicular to the normal, the second unused in 2D. */
function tangents(m: Manifold) {
    const n = m.normal, t1 = m.tangent1, t2 = m.tangent2;
    if (m.a.dimensions === 2)
    {
        t1.x = -n.y; t1.y = n.x; t1.z = 0;
        t2.x = 0; t2.y = 0; t2.z = 0;
        return;
    }
    if (Math.abs(n.x) < 0.57735)
    {
        t1.x = 0; t1.y = n.z; t1.z = -n.y;
    }
    else
    {
        t1.x = n.y; t1.y = -n.x; t1.z = 0;
    }
    const length = Math.sqrt(t1.x * t1.x + t1.y * t1.y + t1.z * t1.z);
    t1.x /= length; t1.y /= length; t1.z /= length;
    cross(n, t1, t2);
}

/** Readies each contact point and re-applies last step's impulses. */
export function prepare(manifolds: Iterable<Manifold>, dt: number) {
    for (const m of manifolds)
    {
        const { a, b, normal: n } = m;
        tangents(m);
        const restitution = Math.max(a.restitution, b.restitution);
        for (let i = 0; i < m.count; i++)
        {
            const point = m.points[i], d = data(point);
            const mx = (point.a.x + point.b.x) / 2, my = (point.a.y + point.b.y) / 2, mz = (point.a.z + point.b.z) / 2;
            d.rA.x = mx - a.position.x; d.rA.y = my - a.position.y; d.rA.z = mz - a.position.z;
            d.rB.x = mx - b.position.x; d.rB.y = my - b.position.y; d.rB.z = mz - b.position.z;
            d.normalMass = effectiveMass(a, b, d.rA, d.rB, n);
            d.tangentMass1 = effectiveMass(a, b, d.rA, d.rB, m.tangent1);
            d.tangentMass2 = a.dimensions === 2 ? 0 : effectiveMass(a, b, d.rA, d.rB, m.tangent2);

            relativeVelocity(a, b, d, r);
            const vn = r.dot(n);
            // a gap may close this step, no faster; else bounce when hitting hard
            d.bias = point.depth < 0 ? point.depth / dt : vn < -BOUNCE_THRESHOLD ? -restitution * vn : 0;

            applyImpulse(a, b, d, n, point.normalImpulse);
            applyImpulse(a, b, d, m.tangent1, point.tangentImpulse1);
            if (a.dimensions === 3) applyImpulse(a, b, d, m.tangent2, point.tangentImpulse2);
        }
    }
}

/** One velocity pass: friction then the non-penetration impulse per point. */
export function solveVelocities(manifolds: Iterable<Manifold>) {
    for (const m of manifolds)
    {
        const { a, b, normal: n } = m;
        const friction = Math.sqrt(a.friction * b.friction);
        for (let i = 0; i < m.count; i++)
        {
            const point = m.points[i], d = data(point);
            const limit = friction * point.normalImpulse;

            relativeVelocity(a, b, d, r);
            let lambda = -d.tangentMass1 * r.dot(m.tangent1);
            let total = Math.max(-limit, Math.min(limit, point.tangentImpulse1 + lambda));
            applyImpulse(a, b, d, m.tangent1, total - point.tangentImpulse1);
            point.tangentImpulse1 = total;

            if (a.dimensions === 3)
            {
                relativeVelocity(a, b, d, r);
                lambda = -d.tangentMass2 * r.dot(m.tangent2);
                total = Math.max(-limit, Math.min(limit, point.tangentImpulse2 + lambda));
                applyImpulse(a, b, d, m.tangent2, total - point.tangentImpulse2);
                point.tangentImpulse2 = total;
            }

            relativeVelocity(a, b, d, r);
            const vn = r.dot(n);
            lambda = d.normalMass * (d.bias - vn);
            total = Math.max(0, point.normalImpulse + lambda);
            applyImpulse(a, b, d, n, total - point.normalImpulse);
            point.normalImpulse = total;
        }
    }
}

/**
 * One position pass: pushes overlapping bodies apart directly, so fixing penetration adds
 * no velocity (no Baumgarte bounce). Returns the deepest penetration seen.
 */
export function solvePositions(manifolds: Iterable<Manifold>): number {
    let deepest = 0;
    for (const m of manifolds)
    {
        const { a, b, normal: n } = m;
        if (a.inverseMass === 0 && b.inverseMass === 0) continue;
        for (let i = 0; i < m.count; i++)
        {
            const point = m.points[i], d = data(point);
            m.refresh(point);
            deepest = Math.max(deepest, point.depth);
            const correction = Math.min(MAX_CORRECTION, BAUMGARTE * (point.depth - SLOP));
            if (correction <= 0) continue;

            const mx = (point.a.x + point.b.x) / 2, my = (point.a.y + point.b.y) / 2, mz = (point.a.z + point.b.z) / 2;
            d.rA.x = mx - a.position.x; d.rA.y = my - a.position.y; d.rA.z = mz - a.position.z;
            d.rB.x = mx - b.position.x; d.rB.y = my - b.position.y; d.rB.z = mz - b.position.z;
            const impulse = effectiveMass(a, b, d.rA, d.rB, n) * correction;
            move(a, d.rA, n, -impulse);
            move(b, d.rB, n, impulse);
        }
    }
    return deepest;
}

function move(body: RigidBody, rv: Vector3, n: Vector3, impulse: number) {
    if (body.inverseMass === 0) return;
    body.position.x += n.x * impulse * body.inverseMass;
    body.position.y += n.y * impulse * body.inverseMass;
    body.position.z += n.z * impulse * body.inverseMass;
    p.x = n.x * impulse; p.y = n.y * impulse; p.z = n.z * impulse;
    cross(rv, p, s);
    multiply3(body.inverseInertia, s.x, s.y, s.z, u);
    body.rotation.integrate(u.x, u.y, u.z, 1);
    body.updateInertia();
}
