type Listener = (...args: any[]) => void;

/** Small event emitter: `on`, `off`, `emit`. */
export class Emitter {
    private listeners = new Map<string, Set<Listener>>();

    on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(listener);
        return this;
    }

    off(event: string, listener: Listener) {
        this.listeners.get(event)?.delete(listener);
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        this.listeners.get(event)?.forEach(listener => listener(...args));
        return this;
    }
}
