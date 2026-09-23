// core.ts — shared
export type EffectFn = () => void
export let currentEffect: { run: EffectFn, deps: Set<Set<EffectFn>> } | null = null
export const setCurrentEffect = (fn: typeof currentEffect) => { currentEffect = fn }

/**
 * Reactive value. Reading it inside an `effect` subscribes that effect; every write re-runs
 * its subscribers, even when the value is unchanged.
 *
 * @returns `[read, write]`. `write` takes a value or an updater `(prev) => next`.
 * @example
 * const [count, setCount] = signal(0);
 * setCount(n => n + 1);
 */
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
