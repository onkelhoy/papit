import type {
    signal as signalType,
    effect as effectType,
    computed as computedType,
} from "@papit/signals";

import { type LanguageJson } from "types";
type ModifiedLanguageJson = LanguageJson & { translations: NonNullable<LanguageJson["translations"]> }
function isModified(entry: LanguageJson): entry is ModifiedLanguageJson {
    return entry.translations !== undefined
}

export function getTranslator(
    signal: typeof signalType,
    effect: typeof effectType,
    computed: typeof computedType,
) {
    const [current, setCurrent] = signal<ModifiedLanguageJson | null>(null);
    const [list, setList] = signal<LanguageJson[]>([]);
    const [locale] = computed(() => current()?.meta?.language ?? null);

    const translate = (key: string, variables?: Record<string, unknown>) => {
        let value = current()?.translations[key] ?? key;

        if (variables)
        {
            value = value.replace(/{([^{}]+)}/g, (match, name) => {
                const v = variables[name];
                if (v === undefined) return match;
                return getStringValue(v);
            });
        }

        return value;
    }

    const handle = async (entry: LanguageJson) => {
        if (entry.url && !entry.translations)
        {
            const data = await fetchTranslation(entry);
            if (!data) return null;

            entry.translations = data;
            if (data.meta)
            {
                entry.meta = data.meta;
            }
        }

        if (!isModified(entry)) return null;

        if (!entry.meta && entry.translations.meta)
        {
            entry.meta = entry.translations.meta;
        }

        setList(prev => {
            const exists = prev.findIndex(e => e.id === entry.id)
            if (exists >= 0)
            {
                const next = [...prev]
                next[exists] = entry
                return next
            }
            return [...prev, entry]
        });
        setCurrent(entry);

        return entry;
    }

    return {
        translate,
        t: translate,
        list,
        locale,
        current,
        add: (entry: LanguageJson) => {
            const exists = list().findIndex(e => e.id === entry.id)
            if (exists >= 0) return  // maybe we could merge it ?
            setList([...list(), entry])
        },
        change: async (entry: string | LanguageJson) => {
            const id = typeof entry === "string" ? entry : entry.id;
            const found = list().find(e => e.id === id)
            if (found) return handle(found)
            if (typeof entry === "string") return null;
            return handle(entry);
        },
        subscribe: (fn: () => void) => {
            let initial = true
            effect(() => {
                current()
                if (initial) { initial = false; return }
                fn()
            })
        },
    }
}

async function fetchTranslation(entry: LanguageJson & { url: string }) {
    try 
    {
        const res = await fetch(entry.url);
        const json = await res.json() as NonNullable<LanguageJson['translations']>;
        return json;
    }
    catch (e)
    {
        console.log("[translation failed to load]", e);
        return null;
    }
}

function getStringValue(value: unknown, depth = 0): string {
    if (depth > 50) throw new Error("[ERROR] translator, max depth for recurrsion reached (50)");
    if (["string", "number", "boolean", "bigint"].includes(typeof value)) return String(value);
    if (value instanceof Date) return value.toISOString();

    if (Array.isArray(value)) return value.map(v => getStringValue(v, depth + 1)).join();
    if (typeof value === "function") return getStringValue(value(), depth + 1);
    if (typeof value === "object") return JSON.stringify(value);

    return "[TRANSLATION-TYPE-NOT-SUPPORTED-APPEND-OR-SUBMIT-ISSUE]";
}