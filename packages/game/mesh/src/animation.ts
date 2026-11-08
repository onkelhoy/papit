import type { GLTFAnimation, GLTFChannel } from "./gltf";
import type { Rig } from "./skin";

// scratch, no allocation per sample
const value = new Float32Array(4);

/**
 * Pose `rig` at `time` seconds of `animation`: translations go to `bone.offset`, rotations
 * to `bone.rotation`. Scale is ignored, the armature has none. Call `rig.armature.update()` after.
 * `loop` wraps the time into the duration, otherwise it clamps.
 */
export function sample(animation: GLTFAnimation, time: number, rig: Rig, loop = true) {
    if (animation.duration > 0) time = loop ? ((time % animation.duration) + animation.duration) % animation.duration : Math.min(Math.max(time, 0), animation.duration);
    for (const channel of animation.channels)
    {
        if (channel.path === "scale") continue;
        const bone = rig.nodes.get(channel.node);
        if (!bone) continue;
        const size = channel.path === "rotation" ? 4 : 3;
        sampleChannel(channel, time, size, value);
        if (size === 4) bone.rotation.set(value);
        else bone.offset.set(value.subarray(0, 3));
    }
}

/** Value of `channel` at `time` into `out` (`size` values). */
export function sampleChannel(channel: GLTFChannel, time: number, size: number, out: Float32Array) {
    const { times, values, interpolation } = channel;
    const cubic = interpolation === "CUBICSPLINE";
    const stride = cubic ? size * 3 : size;
    const at = (key: number, i: number) => values[key * stride + (cubic ? size : 0) + i];
    const last = times.length - 1;

    if (last <= 0 || time <= times[0] || time >= times[last])
    {
        const key = last <= 0 || time <= times[0] ? 0 : last;
        for (let i = 0; i < size; i++) out[i] = at(key, i);
        return out;
    }

    // binary search for the key before time
    let low = 0, high = last;
    while (high - low > 1)
    {
        const middle = (low + high) >> 1;
        if (times[middle] <= time) low = middle;
        else high = middle;
    }
    const span = times[high] - times[low];
    const t = span > 0 ? (time - times[low]) / span : 0;

    if (interpolation === "STEP")
    {
        for (let i = 0; i < size; i++) out[i] = at(low, i);
    }
    else if (cubic)
    {
        const t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        for (let i = 0; i < size; i++)
        {
            const outTangent = values[low * stride + size * 2 + i];
            const inTangent = values[high * stride + i];
            out[i] = h00 * at(low, i) + h10 * span * outTangent + h01 * at(high, i) + h11 * span * inTangent;
        }
    }
    else if (size === 4)
    {
        slerp(values, low * stride, high * stride, t, out);
    }
    else
    {
        for (let i = 0; i < size; i++) out[i] = at(low, i) + (at(high, i) - at(low, i)) * t;
    }

    if (size === 4 && interpolation !== "LINEAR") normalize(out);
    return out;
}

function slerp(v: Float32Array, a: number, b: number, t: number, out: Float32Array) {
    let dot = v[a] * v[b] + v[a + 1] * v[b + 1] + v[a + 2] * v[b + 2] + v[a + 3] * v[b + 3];
    const sign = dot < 0 ? -1 : 1;
    dot *= sign;
    let wa = 1 - t, wb = t * sign;
    if (dot < .9995)
    {
        const angle = Math.acos(dot), sin = Math.sin(angle);
        wa = Math.sin((1 - t) * angle) / sin;
        wb = Math.sin(t * angle) / sin * sign;
    }
    for (let i = 0; i < 4; i++) out[i] = v[a + i] * wa + v[b + i] * wb;
    normalize(out);
}

function normalize(q: Float32Array) {
    const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    for (let i = 0; i < 4; i++) q[i] /= length;
}
