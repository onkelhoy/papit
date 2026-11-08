import { bounds } from "./bounds";
import type { Mesh } from "./types";

export type GLTFNode = {
    name?: string;
    /** index into `meshes` */
    mesh?: number;
    /** index into `skins` */
    skin?: number;
    children: number[];
    translation: [number, number, number];
    /** quaternion xyzw */
    rotation: [number, number, number, number];
    scale: [number, number, number];
    /** column major, when the file gives a matrix instead of TRS */
    matrix?: number[];
};

export type GLTFSkin = {
    name?: string;
    /** node indices, joint `i` of a vertex is `joints[i]` */
    joints: number[];
    /** column major 4x4 per joint */
    inverseBindMatrices?: Float32Array;
    skeleton?: number;
};

export type GLTF = {
    /** one entry per glTF mesh, one `Mesh` per primitive */
    meshes: { name?: string; primitives: Mesh[] }[];
    nodes: GLTFNode[];
    skins: GLTFSkin[];
    /** root node indices of the default scene */
    roots: number[];
    animations: GLTFAnimation[];
};

export type GLTFChannel = {
    node: number;
    path: "translation" | "rotation" | "scale";
    interpolation: "LINEAR" | "STEP" | "CUBICSPLINE";
    /** keyframe times in seconds, ascending */
    times: Float32Array;
    /** 3 or 4 values per key; CUBICSPLINE stores in-tangent, value, out-tangent per key */
    values: Float32Array;
};

export type GLTFAnimation = { name?: string; duration: number; channels: GLTFChannel[] };

export type GLTFOptions = {
    /** resolves external buffer uris in `.gltf` files, default `fetch` relative to `base` */
    load?: (uri: string) => Promise<ArrayBuffer>;
    base?: string;
};

const GLB_MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;
const SIZES: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const TRIANGLES = 4;

/** Load a `.glb` or `.gltf` from a url. */
export async function loadGLTF(url: string, options: GLTFOptions = {}): Promise<GLTF> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`gltf: ${response.status} for ${url}`);
    return parseGLTF(await response.arrayBuffer(), { base: url, ...options });
}

/** Parse glTF 2.0: a `.glb` buffer, `.gltf` text as a buffer, or the parsed JSON. */
export async function parseGLTF(data: ArrayBuffer | object, options: GLTFOptions = {}): Promise<GLTF> {
    let json: any;
    let binary: ArrayBuffer | undefined;

    if (data instanceof ArrayBuffer)
    {
        const view = new DataView(data);
        if (data.byteLength >= 12 && view.getUint32(0, true) === GLB_MAGIC)
        {
            if (view.getUint32(4, true) !== 2) throw new Error("gltf: only version 2 is supported");
            let offset = 12;
            while (offset + 8 <= data.byteLength)
            {
                const length = view.getUint32(offset, true);
                const type = view.getUint32(offset + 4, true);
                const chunk = data.slice(offset + 8, offset + 8 + length);
                if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(chunk));
                else if (type === CHUNK_BIN && !binary) binary = chunk;
                offset += 8 + length;
            }
            if (!json) throw new Error("gltf: glb has no JSON chunk");
        }
        else json = JSON.parse(new TextDecoder().decode(data));
    }
    else json = data;

    if (!String(json.asset?.version ?? "").startsWith("2")) throw new Error("gltf: only version 2 is supported");

    const buffers = await Promise.all((json.buffers ?? []).map((buffer: any, i: number) => {
        if (buffer.uri === undefined)
        {
            if (i === 0 && binary) return binary;
            throw new Error(`gltf: buffer ${i} has no data`);
        }
        if (buffer.uri.startsWith("data:")) return decodeDataUri(buffer.uri);
        const load = options.load ?? (async (uri: string) => {
            const response = await fetch(new URL(uri, options.base ?? location.href));
            if (!response.ok) throw new Error(`gltf: ${response.status} for ${uri}`);
            return response.arrayBuffer();
        });
        return load(buffer.uri);
    })) as ArrayBuffer[];

    const accessor = (index: number) => readAccessor(json, buffers, index);

    const meshes = (json.meshes ?? []).map((mesh: any) => ({
        name: mesh.name,
        primitives: mesh.primitives
            .filter((primitive: any) => (primitive.mode ?? TRIANGLES) === TRIANGLES)
            .map((primitive: any) => readPrimitive(json, primitive, accessor)),
    }));

    const nodes: GLTFNode[] = (json.nodes ?? []).map((node: any) => ({
        name: node.name,
        mesh: node.mesh,
        skin: node.skin,
        children: node.children ?? [],
        translation: node.translation ?? [0, 0, 0],
        rotation: node.rotation ?? [0, 0, 0, 1],
        scale: node.scale ?? [1, 1, 1],
        matrix: node.matrix,
    }));

    const skins: GLTFSkin[] = (json.skins ?? []).map((skin: any) => ({
        name: skin.name,
        joints: skin.joints,
        inverseBindMatrices: skin.inverseBindMatrices === undefined ? undefined : toFloat(accessor(skin.inverseBindMatrices)),
        skeleton: skin.skeleton,
    }));

    const animations: GLTFAnimation[] = (json.animations ?? []).map((animation: any) => {
        const channels: GLTFChannel[] = animation.channels
            .filter((channel: any) => channel.target.node !== undefined && channel.target.path !== "weights")
            .map((channel: any) => {
                const sampler = animation.samplers[channel.sampler];
                return {
                    node: channel.target.node,
                    path: channel.target.path,
                    interpolation: sampler.interpolation ?? "LINEAR",
                    times: toFloat(accessor(sampler.input)),
                    values: toFloat(accessor(sampler.output)),
                };
            });
        const duration = channels.reduce((max, c) => Math.max(max, c.times[c.times.length - 1] ?? 0), 0);
        return { name: animation.name, duration, channels };
    });

    const scene = json.scenes?.[json.scene ?? 0];
    const roots = scene?.nodes ?? nodes.map((_, i) => i).filter(i => !nodes.some(n => n.children.includes(i)));

    return { meshes, nodes, skins, roots, animations };
}

function readPrimitive(json: any, primitive: any, accessor: (i: number) => Accessor): Mesh {
    const attributes = primitive.attributes;
    if (attributes.POSITION === undefined) throw new Error("gltf: primitive has no POSITION");

    const positions = toFloat(accessor(attributes.POSITION));
    const vertexCount = positions.length / 3;
    const indices = primitive.indices === undefined ? undefined : toIndices(accessor(primitive.indices).values, vertexCount);
    const normals = attributes.NORMAL === undefined ? computeNormals(positions, indices) : toFloat(accessor(attributes.NORMAL));

    // colour: COLOR_0 times the material base colour
    const base: number[] = json.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
    const colors = new Float32Array(vertexCount * 4);
    const source = attributes.COLOR_0 === undefined ? undefined : accessor(attributes.COLOR_0);
    const sourceColors = source ? toFloat(source) : undefined;
    const sourceSize = source?.size ?? 4;
    for (let v = 0; v < vertexCount; v++)
    {
        for (let c = 0; c < 4; c++)
        {
            const value = sourceColors && c < sourceSize ? sourceColors[v * sourceSize + c] : 1;
            colors[v * 4 + c] = value * base[c];
        }
    }

    const mesh: Mesh = { positions, normals, colors, bounds: bounds(positions) };
    if (indices) mesh.indices = indices;
    if (attributes.TEXCOORD_0 !== undefined) mesh.uvs = toFloat(accessor(attributes.TEXCOORD_0));
    if (attributes.JOINTS_0 !== undefined) mesh.joints = Uint16Array.from(accessor(attributes.JOINTS_0).values);
    if (attributes.WEIGHTS_0 !== undefined) mesh.weights = toFloat(accessor(attributes.WEIGHTS_0));
    return mesh;
}

type Accessor = { values: ArrayLike<number>; size: number; normalized: boolean; componentType: number };

const COMPONENTS: Record<number, [number, (view: DataView, offset: number) => number, number]> = {
    5120: [1, (v, o) => v.getInt8(o), 127],
    5121: [1, (v, o) => v.getUint8(o), 255],
    5122: [2, (v, o) => v.getInt16(o, true), 32767],
    5123: [2, (v, o) => v.getUint16(o, true), 65535],
    5125: [4, (v, o) => v.getUint32(o, true), 4294967295],
    5126: [4, (v, o) => v.getFloat32(o, true), 1],
};

function readAccessor(json: any, buffers: ArrayBuffer[], index: number): Accessor {
    const accessor = json.accessors?.[index];
    if (!accessor) throw new Error(`gltf: missing accessor ${index}`);
    const size = SIZES[accessor.type];
    const component = COMPONENTS[accessor.componentType];
    if (!size || !component) throw new Error(`gltf: unsupported accessor ${index}`);
    const [bytes, read] = component;
    const values = new Float64Array(accessor.count * size);

    if (accessor.bufferView !== undefined)
    {
        const bufferView = json.bufferViews[accessor.bufferView];
        const view = new DataView(buffers[bufferView.buffer]);
        const stride = bufferView.byteStride ?? size * bytes;
        const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        for (let i = 0; i < accessor.count; i++)
        {
            for (let c = 0; c < size; c++) values[i * size + c] = read(view, start + i * stride + c * bytes);
        }
    }
    if (accessor.sparse) throw new Error("gltf: sparse accessors are not supported");

    return { values, size, normalized: !!accessor.normalized, componentType: accessor.componentType };
}

function toFloat({ values, normalized, componentType }: Accessor): Float32Array {
    const out = Float32Array.from(values);
    if (normalized)
    {
        const max = COMPONENTS[componentType][2];
        for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i] / max, -1);
    }
    return out;
}

function toIndices(values: ArrayLike<number>, vertexCount: number) {
    return vertexCount > 65535 ? Uint32Array.from(values) : Uint16Array.from(values);
}

function computeNormals(positions: Float32Array, indices?: Uint16Array | Uint32Array) {
    const normals = new Float32Array(positions.length);
    const count = indices ? indices.length : positions.length / 3;
    for (let k = 0; k + 2 < count; k += 3)
    {
        const a = (indices ? indices[k] : k) * 3, b = (indices ? indices[k + 1] : k + 1) * 3, c = (indices ? indices[k + 2] : k + 2) * 3;
        const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
        const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const i of [a, b, c]) { normals[i] += nx; normals[i + 1] += ny; normals[i + 2] += nz; }
    }
    for (let i = 0; i < normals.length; i += 3)
    {
        const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
        normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length;
    }
    return normals;
}

function decodeDataUri(uri: string): ArrayBuffer {
    const base64 = uri.slice(uri.indexOf(",") + 1);
    const text = atob(base64);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return bytes.buffer;
}
