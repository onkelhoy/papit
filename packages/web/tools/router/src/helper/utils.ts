export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object')
    {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj))
    {
        return obj.map(item => deepClone(item)) as unknown as T;
    }

    // Handle objects and symbols
    const clonedObj: Record<string | symbol, any> = {};
    for (const key of Reflect.ownKeys(obj))
    {
        clonedObj[key] = deepClone((obj as Record<string | symbol, any>)[key]);
    }

    return clonedObj as T;
}

export async function hash(content: string, encoder: TextEncoder) {
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}