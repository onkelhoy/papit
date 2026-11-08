import { fade, targetOf, valueAt } from "./fade";
import type { FadeOptions } from "./types";

/** A named mixing channel (music, sfx, ...) with its own volume. */
export class Bus {
    readonly gain: GainNode;

    private volumeBeforeMute = 1;
    private isMuted = false;

    constructor(readonly name: string, readonly context: BaseAudioContext, output: AudioNode) {
        this.gain = context.createGain();
        this.gain.connect(output);
    }

    /** Current volume, mid-fade included. */
    get volume(): number {
        return valueAt(this.gain.gain, this.context.currentTime);
    }

    /** Sets the volume right away. */
    set volume(value: number) {
        this.fadeTo(value, { seconds: 0 });
    }

    /** Volume the bus is heading to. */
    get target(): number {
        return targetOf(this.gain.gain);
    }

    get muted(): boolean {
        return this.isMuted;
    }

    fadeTo(volume: number, options: FadeOptions = {}): this {
        this.isMuted = false;
        fade(this.gain.gain, this.context, volume, options.seconds ?? 1, options.curve);
        return this;
    }

    /** Fades to silence and remembers the volume for `unmute()`. */
    mute(options: FadeOptions = { seconds: 0 }): void {
        if (this.isMuted) return;
        this.volumeBeforeMute = this.target;
        this.fadeTo(0, options);
        this.isMuted = true;
    }

    unmute(options: FadeOptions = { seconds: 0 }): void {
        if (!this.isMuted) return;
        this.fadeTo(this.volumeBeforeMute, options);
    }

    /** @internal */
    disconnect(): void {
        this.gain.disconnect();
    }
}
