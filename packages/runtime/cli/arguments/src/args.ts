import { Loglevel, type Level } from "./loglevel";

type Primitive = string | number | boolean;
type Input = Primitive | Primitive[];
export class Args extends Loglevel {
    flags: Record<string, string[]> = {};
    values: string[] = [];

    private convert(value: Input): string[] {
        if (Array.isArray(value)) return value.map(String);
        if (value === true) return [];
        return [String(value)];
    }

    toggle(key: string) { this.set(key, !this.has(key)) }
    get(key: string) { return this.flags[key] }
    set(key: string, value: Input) {
        this.flags[key] = this.convert(value)
    }
    add(key: string, value: Input) {
        this.flags[key] = [...(this.flags[key] ?? []), ...this.convert(value)];
    }
    has(key: string) { return !!this.get(key) }
    true(key: string) { return this.has(key) ? true : undefined }
    string(key: string) {
        const value = this.get(key);
        return value?.at(0);
    }
    number(key: string) {
        const value = this.string(key);
        if (value === undefined) return undefined;
        const num = Number(value);
        if (Number.isNaN(num)) return undefined;
        return num;
    }

    constructor(input: Input, islands: string[] = []) {
        super();
        const converted = this.convert(input);

        let flagName: string | null = null;
        converted.forEach(arg => {
            const match = arg.match(/^(?<flag>--?)(?<name>[^=]+)(=(?<value>.*))?$/);

            if (!match)
            {
                if (flagName) this.set(flagName, arg);
                else this.values.push(arg);

                flagName = null;
                return;
            }

            const { value, name } = match.groups ?? {};

            if (match.groups?.flag == "-" && value)
            {
                // we treat as multiple groups 
                for (let j = 0; j < name.length; j++)
                {
                    this.toggle(name[j]);
                }
                return;
            }

            if (!islands.includes(name))
            {
                flagName = name;
            }

            this.add(name, value);
        });

        super.init(this);
    }
}

export class Arguments {
    static instance: Args;
    static init(input: Input, islands: string[] = []) {
        if (!this.instance) this.instance = new Args(input, islands);
    }

    static toggle(key: string) { return this.instance.toggle(key) }
    static get(key: string) { return this.instance.get(key) }
    static set(key: string, value: Input) { return this.instance.set(key, value) }
    static add(key: string, value: Input) { return this.instance.add(key, value) }
    static has(key: string) { return this.instance.has(key) }
    static true(key: string) { return this.instance.true(key) }
    static string(key: string) { return this.instance.string(key) }
    static number(key: string) { return this.instance.number(key) }

    static get level() { return this.instance.level }
    static set level(value: Level) { this.instance.level = value }
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

    static get isCLI() { return process.env.npm_lifecycle_event === "npx" }
}

(function () {
    Arguments.init(process.argv);
}())