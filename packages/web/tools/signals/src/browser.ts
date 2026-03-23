import { signal, setCurrentEffect, EffectFn } from './core'

export { signal }

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

export function computed<T>(fn: () => T) {
    const [read, write] = signal<T>(undefined!)
    const dispose = effect(() => write(fn()))
    return [read, dispose] as const
}