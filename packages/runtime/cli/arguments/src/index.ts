// exports
export * from "./args";
export * from "./loglevel";

import { ArgInput, Args } from "./args";
import { LogLevel } from "./loglevel";

export class Arguments {
    private static levelInstance = new LogLevel();
    private static argsInstance = new Args(process.argv);

    static set() {

    }

    // Arguments

    toggle(key: string) { return this.toggle(key,) }
    get(key: string) { return this.get(key,) }
    set(key: string, value: ArgInput) { return this.set(key,) }
    add(key: string, value: ArgInput) { return this.add(key,) }
    has(key: string) { return this.has(key,) }
    string(key: string) { return this.string(key,) }
    number(key: string) { return this.number(key,) }

    // Level
    static get level() { return this.levelInstance.level }
    static get silent() { return this.levelInstance.silent }
    static get debug() { return this.levelInstance.debug }
    static get verbose() { return this.levelInstance.verbose }
    static get info() { return this.levelInstance.info }
    static get warning() { return this.levelInstance.warning }
    static get error() { return this.levelInstance.error }
    static set silent(value: boolean) { this.levelInstance.silent = value }
    static set debug(value: boolean) { this.levelInstance.debug = value }
    static set verbose(value: boolean) { this.levelInstance.verbose = value }
    static set info(value: boolean) { this.levelInstance.info = value }
    static set warning(value: boolean) { this.levelInstance.warning = value }
    static set error(value: boolean) { this.levelInstance.error = value }
}
