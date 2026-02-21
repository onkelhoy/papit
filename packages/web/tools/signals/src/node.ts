import { AsyncLocalStorage } from 'async_hooks'
import { EffectFn, signal } from './core'

export { signal }

const store = new AsyncLocalStorage<EffectFn>();

export function effect(fn: () => void): () => void {
    store.run(fn, fn)
    return () => { }  // no-op dispose for node
}

export function computed<T>(fn: () => T) {
    const [read, write] = signal<T>(undefined!)
    const dispose = effect(() => write(fn()))
    return [read, dispose] as const
}