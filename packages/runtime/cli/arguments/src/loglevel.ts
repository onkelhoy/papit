export type Level = "verbose" | "debug" | "info" | "error" | "warning" | "silent";
export class Instance {
    level: Level = "silent";

    get silent() {
        return this.level === "silent";
    }
    get debug() {
        return this.level === "debug";
    }
    get verbose() {
        return ["verbose", "debug"].includes(this.level);
    }
    get info() {
        return ["info", "debug", "verbose"].includes(this.level);
    }
    get warning() {
        return ["warning", "debug", "verbose", "info"].includes(this.level);
    }
    get error() {
        return ["error", "debug", "verbose", "info", "warning"].includes(this.level);
    }

    set silent(value: boolean) {
        if (value) this.level = "silent";
        else if (this.silent) this.level = "info"
    }
    set debug(value: boolean) {
        if (value) this.level = "debug";
        else if (this.debug) this.level = "verbose"
    }
    set verbose(value: boolean) {
        if (value) this.level = "verbose";
        else if (this.verbose) this.level = "info"
    }
    set info(value: boolean) {
        if (value) this.level = "info";
        else if (this.info) this.level = "warning"
    }
    set warning(value: boolean) {
        if (value) this.level = "warning";
        else if (this.warning) this.level = "error"
    }
    set error(value: boolean) {
        if (value) this.level = "error";
        else if (this.error) this.level = "silent"
    }
}

export class Loglevel {
    private static instance = new Instance();

    static get level() { return this.instance.level }
    static get silent() { return this.instance.silent }
    static get debug() { return this.instance.debug }
    static get verbose() { return this.instance.verbose }
    static get info() { return this.instance.info }
    static get warning() { return this.instance.warning }
    static get error() { return this.instance.error }
    static set silent(value: boolean) { this.instance.silent = value }
    static set debug(value: boolean) { this.instance.debug = value }
    static set verbose(value: boolean) { this.instance.verbose = value }
    static set info(value: boolean) { this.instance.info = value }
    static set warning(value: boolean) { this.instance.warning = value }
    static set error(value: boolean) { this.instance.error = value }
}