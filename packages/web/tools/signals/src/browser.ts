import { signal, setCurrentEffect, EffectFn } from './core'

export { signal }

/**
 * Runs `fn` now and again whenever a signal it read is written.
 * @returns dispose function that stops the re-runs
 */
export function effect(fn: () => void): () => void {
    const deps = new Set<Set<EffectFn>>()
    const run = () => {
        setCurrentEffect({ run, deps })
        fn()
        setCurrentEffect(null)
    }
    run()
    return () => deps.forEach(subs => subs.delete(run))
}

/**
 * Read-only signal derived from `fn`, recomputed whenever a signal it reads is written.
 * @returns `[read, dispose]`
 */
export function computed<T>(fn: () => T) {
    const [read, write] = signal<T>(undefined!)
    const dispose = effect(() => write(fn()))
    return [read, dispose] as const
}