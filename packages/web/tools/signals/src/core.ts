// core.ts — shared
export type EffectFn = () => void
export let currentEffect: { run: EffectFn, deps: Set<Set<EffectFn>> } | null = null
export const setCurrentEffect = (fn: typeof currentEffect) => { currentEffect = fn }

export function signal<T>(initial: T) {
    let value = initial
    const subs = new Set<EffectFn>()

    const read = () => {
        if (currentEffect)
        {
            subs.add(currentEffect.run)
            currentEffect.deps.add(subs)  // effect tracks which subs sets it's in
        }
        return value
    }
    const write = (next: T | ((prev: T) => T)) => {
        value = typeof next === 'function' ? (next as any)(value) : next
        subs.forEach(fn => fn())
    }

    return [read, write] as const
}
