export function logger(name?: string) {
    return {
        log(...args: any[]) { console.log(...[name ? `[${name}]` : undefined, ...args].filter(v => v !== undefined)) },
        error(...args: any[]) { console.error(...[name ? `[${name}]` : undefined, ...args].filter(v => v !== undefined)) },
        debug(...args: any[]) { console.debug(...[name ? `[${name}]` : undefined, ...args].filter(v => v !== undefined)) },
        trace(...args: any[]) { console.trace(...[name ? `[${name}]` : undefined, ...args].filter(v => v !== undefined)) },
    }
}