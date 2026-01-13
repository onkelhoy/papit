import { type Args } from "./args";

export type Level = "verbose" | "debug" | "info" | "error" | "warning" | "silent";
export class Loglevel {
    level: Level = "silent";

    init(args: Args) 
    {
        if (args.has("debug")) this.level = "debug";
        if (args.has("verbose")) this.level = "verbose";
        if (args.has("info")) this.level = "info";
        if (args.has("warning")) this.level = "warning";
        if (args.has("error")) this.level = "error";
        if (args.has("silent")) this.level = "silent";
    }

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