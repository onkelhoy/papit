import { Vector3 } from "@papit/vector";
import type { RigidBody } from "./body";
import { rotate, unrotate } from "./math";
import { MAX_RAW_POINTS, type RawContact } from "./narrow";

/** A kept contact point with what the solver needs to warm start. */
export type ManifoldPoint = {
    /** stays the same while the point persists across steps */
    id: number;
    /** anchor in a's local frame */
    localA: Vector3;
    /** anchor in b's local frame */
    localB: Vector3;
    /** world point on a, refreshed each step */
    a: Vector3;
    /** world point on b, refreshed each step */
    b: Vector3;
    depth: number;
    /** accumulated impulses from the last step */
    normalImpulse: number;
    tangentImpulse1: number;
    tangentImpulse2: number;
};

/** squared distance within which a new point is an old point moved a little */
const MATCH = 0.02 * 0.02;
/** squared sideways drift after which an old point is dropped */
const DRIFT = 0.02 * 0.02;
/** an old point is dropped once separated by more than this */
const SEPARATED = 0.01;

let nextId = 1;
const scratch = new Vector3(0, 0, 0);

function point(): ManifoldPoint {
    return { id: 0, localA: new Vector3(0, 0, 0), localB: new Vector3(0, 0, 0), a: new Vector3(0, 0, 0), b: new Vector3(0, 0, 0), depth: 0, normalImpulse: 0, tangentImpulse1: 0, tangentImpulse2: 0 };
}

function copy(from: ManifoldPoint, to: ManifoldPoint) {
    to.id = from.id;
    to.localA.x = from.localA.x; to.localA.y = from.localA.y; to.localA.z = from.localA.z;
    to.localB.x = from.localB.x; to.localB.y = from.localB.y; to.localB.z = from.localB.z;
    to.a.x = from.a.x; to.a.y = from.a.y; to.a.z = from.a.z;
    to.b.x = from.b.x; to.b.y = from.b.y; to.b.z = from.b.z;
    to.depth = from.depth;
    to.normalImpulse = from.normalImpulse;
    to.tangentImpulse1 = from.tangentImpulse1;
    to.tangentImpulse2 = from.tangentImpulse2;
}

/**
 * The contact between one pair of bodies, kept across steps: up to 4 points (2 in 2D),
 * each matched to last step's points so the solver can start from last step's impulses.
 */
export class Manifold {
    readonly normal: Vector3 = new Vector3(0, 0, 0);
    readonly points: ManifoldPoint[] = [point(), point(), point(), point()];
    count = 0;
    /** @internal last step the pair touched */
    stamp = 0;
    /** tangent directions for friction, set by the solver */
    readonly tangent1: Vector3 = new Vector3(0, 0, 0);
    readonly tangent2: Vector3 = new Vector3(0, 0, 0);

    // candidates: kept points first, then fresh ones
    private readonly candidates: ManifoldPoint[] = [];
    private readonly chosen = new Int32Array(4);

    constructor(readonly a: RigidBody, readonly b: RigidBody) {
        for (let i = 0; i < MAX_RAW_POINTS + 4; i++) this.candidates.push(point());
    }

    /** Merges this step's raw contact into the manifold. */
    update(raw: RawContact) {
        const { a, b } = this;
        this.normal.x = raw.normal.x; this.normal.y = raw.normal.y; this.normal.z = raw.normal.z;
        let count = 0;

        // fresh points, carrying impulses from the old point they match
        for (let i = 0; i < raw.count; i++)
        {
            const source = raw.points[i];
            const c = this.candidates[count++];
            c.a.x = source.a.x; c.a.y = source.a.y; c.a.z = source.a.z;
            c.b.x = source.b.x; c.b.y = source.b.y; c.b.z = source.b.z;
            c.depth = source.depth;
            unrotate(a.rotation, c.a.x - a.position.x, c.a.y - a.position.y, c.a.z - a.position.z, c.localA);
            unrotate(b.rotation, c.b.x - b.position.x, c.b.y - b.position.y, c.b.z - b.position.z, c.localB);

            const old = this.match(c.localA);
            if (old)
            {
                c.id = old.id;
                c.normalImpulse = old.normalImpulse;
                c.tangentImpulse1 = old.tangentImpulse1;
                c.tangentImpulse2 = old.tangentImpulse2;
                old.id = -old.id; // used
            }
            else
            {
                c.id = nextId++;
                c.normalImpulse = c.tangentImpulse1 = c.tangentImpulse2 = 0;
            }
        }

        // old points nobody matched, still touching and not slid away
        for (let i = 0; i < this.count; i++)
        {
            const old = this.points[i];
            if (old.id < 0) continue;
            this.refresh(old);
            if (old.depth < -SEPARATED) continue;
            const n = this.normal;
            const dx = old.a.x - old.b.x - n.x * old.depth;
            const dy = old.a.y - old.b.y - n.y * old.depth;
            const dz = old.a.z - old.b.z - n.z * old.depth;
            if (dx * dx + dy * dy + dz * dz > DRIFT) continue;
            copy(old, this.candidates[count++]);
        }

        this.reduce(count);
    }

    /** Recomputes world points and depth from the local anchors. */
    refresh(p: ManifoldPoint) {
        const { a, b, normal: n } = this;
        rotate(a.rotation, p.localA.x, p.localA.y, p.localA.z, p.a);
        p.a.x += a.position.x; p.a.y += a.position.y; p.a.z += a.position.z;
        rotate(b.rotation, p.localB.x, p.localB.y, p.localB.z, p.b);
        p.b.x += b.position.x; p.b.y += b.position.y; p.b.z += b.position.z;
        p.depth = (p.a.x - p.b.x) * n.x + (p.a.y - p.b.y) * n.y + (p.a.z - p.b.z) * n.z;
    }

    private match(localA: Vector3): ManifoldPoint | undefined {
        let best: ManifoldPoint | undefined, bestDistance = MATCH;
        for (let i = 0; i < this.count; i++)
        {
            const old = this.points[i];
            if (old.id < 0) continue;
            const dx = old.localA.x - localA.x, dy = old.localA.y - localA.y, dz = old.localA.z - localA.z;
            const distance = dx * dx + dy * dy + dz * dz;
            if (distance < bestDistance)
            {
                bestDistance = distance;
                best = old;
            }
        }
        return best;
    }

    /** Keeps the deepest point and the ones spanning the largest area. */
    private reduce(count: number) {
        const limit = this.a.dimensions === 2 ? 2 : 4;
        const c = this.candidates, chosen = this.chosen;
        let kept = 0;

        if (count <= limit)
        {
            for (let i = 0; i < count; i++) chosen[kept++] = i;
        }
        else
        {
            // deepest
            let best = 0;
            for (let i = 1; i < count; i++) if (c[i].depth > c[best].depth) best = i;
            chosen[kept++] = best;
            // furthest from it
            chosen[kept++] = this.pick(count, kept);
            if (limit > 2)
            {
                // largest triangle, then the largest addition to it
                chosen[kept++] = this.pick(count, kept);
                chosen[kept++] = this.pick(count, kept);
            }
        }

        for (let i = 0; i < kept; i++) copy(c[chosen[i]], this.points[i]);
        this.count = kept;
    }

    /** next candidate: furthest from the first, then the one growing the covered area most */
    private pick(count: number, kept: number): number {
        const c = this.candidates, chosen = this.chosen;
        let best = -1, bestScore = -1;
        for (let i = 0; i < count; i++)
        {
            let taken = false;
            for (let k = 0; k < kept; k++) if (this.chosen[k] === i) taken = true;
            if (taken) continue;
            const p = c[i].a;
            const s = kept === 1 ? distance2(p, c[chosen[0]].a)
                : kept === 2 ? area(c[chosen[0]].a, c[chosen[1]].a, p)
                : area(c[chosen[0]].a, c[chosen[1]].a, p) + area(c[chosen[1]].a, c[chosen[2]].a, p) + area(c[chosen[2]].a, c[chosen[0]].a, p);
            if (s > bestScore)
            {
                bestScore = s;
                best = i;
            }
        }
        return best;
    }
}

function distance2(a: Vector3, b: Vector3) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

/** twice the triangle area */
function area(a: Vector3, b: Vector3, c: Vector3) {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    scratch.x = uy * vz - uz * vy;
    scratch.y = uz * vx - ux * vz;
    scratch.z = ux * vy - uy * vx;
    return Math.sqrt(scratch.x * scratch.x + scratch.y * scratch.y + scratch.z * scratch.z);
}
