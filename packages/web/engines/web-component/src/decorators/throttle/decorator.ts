import { STANDARD_DELAY } from "../../constants";
import type { Options } from "./types";

export function throttle(): MethodDecorator;
export function throttle(delay: number): MethodDecorator;
export function throttle(name: string): MethodDecorator;
export function throttle(options: Partial<Options>): MethodDecorator;
export function throttle(
    target: any,
    propertyKey: PropertyKey,
    descriptor: PropertyDescriptor
): void;

export function throttle(
    ...args:
        | [any, PropertyKey, PropertyDescriptor]
        | [number | string | Partial<Options>]
): MethodDecorator | void {
    if (args.length === 3 && typeof args[2] === "object")
    {
        const [target, key, descriptor] = args;
        return define({ delay: STANDARD_DELAY }, target, key, descriptor);
    }

    const opts = normalizeArgs(args[0]);

    return function (
        target: any,
        key: PropertyKey,
        descriptor: PropertyDescriptor
    ): void {
        define(opts, target, key, descriptor);
    };
}

function normalizeArgs(arg: any): Options {
    if (typeof arg === "number") return { delay: arg };
    if (typeof arg === "string") return { delay: STANDARD_DELAY, name: arg };
    return { delay: STANDARD_DELAY, ...arg };
}
function define(
    options: Options,
    target: any,
    key: PropertyKey,
    descriptor: PropertyDescriptor
) {
    const original = descriptor.value;
    const timerKey = Symbol(`throttle_timer_${String(key)}`);
    const pendingArgsKey = Symbol(`throttle_pendingArgs_${String(key)}`);
    const pendingThisKey = Symbol(`throttle_pendingThis_${String(key)}`);

    function throttled(this: any, ...args: any[]) {
        if (this[timerKey])
        {
            this[pendingArgsKey] = args;
            this[pendingThisKey] = this;
            return;
        }

        original.apply(this, args);

        const self = this;
        const schedule = () => {
            self[timerKey] = setTimeout(() => {
                self[timerKey] = null;

                if (self[pendingArgsKey] !== undefined)
                {
                    const a = self[pendingArgsKey];
                    self[pendingArgsKey] = undefined;
                    self[pendingThisKey] = undefined;
                    original.apply(self, a);
                    schedule();
                }
            }, options.delay);
        };

        schedule();
    }

    if (options.name)
    {
        Object.defineProperty(target, String(options.name), {
            configurable: true,
            enumerable: false,
            writable: true,
            value: throttled,
        });
    } else
    {
        descriptor.value = throttled;
    }
}