import { STANDARD_DELAY } from "../../constants";

export function Function<T extends (...args: any[]) => any>(
    execute: T,
    delay: number = STANDARD_DELAY
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingArgs: Parameters<T> | null = null;
    let pendingThis: ThisParameterType<T> | null = null;

    const schedule = () => {
        timer = setTimeout(() => {
            timer = null;

            if (pendingArgs !== null)
            {
                const args = pendingArgs;
                const ctx = pendingThis;
                pendingArgs = null;
                pendingThis = null;
                execute.apply(ctx, args);
                schedule(); // keep window alive as long as calls come in
            }
        }, delay);
    };

    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        if (timer)
        {
            // in the window — save latest for trailing
            pendingArgs = args;
            pendingThis = this;
            return;
        }

        // leading edge
        execute.apply(this, args);
        schedule();
    };
}