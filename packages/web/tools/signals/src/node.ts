import { AsyncLocalStorage } from 'async_hooks'
import { EffectFn, signal } from './core'

export { signal }

const store = new AsyncLocalStorage<EffectFn>();

/**
 * Runs `fn` once. Unlike the browser entry it doesn't re-run when signals change yet.
 * @returns no-op dispose function, for API parity with the browser entry
 */
export function effect(fn: () => void): () => void {
    store.run(fn, fn)
    return () => { }  // no-op dispose for node
}

/**
 * Signal holding `fn()` evaluated once. Unlike the browser entry it doesn't recompute yet.
 * @returns `[read, dispose]`
 */
export function computed<T>(fn: () => T) {
    const [read, write] = signal<T>(undefined!)
    const dispose = effect(() => write(fn()))
    return [read, dispose] as const
}