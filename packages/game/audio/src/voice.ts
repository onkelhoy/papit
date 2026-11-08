import { fade, targetOf, valueAt } from "./fade";
import type { FadeOptions, SpatialOptions, Vec3 } from "./types";

/**
 * Calls `fn` after `seconds` of audio time, so it stays in step with fades
 * and pauses while the context is suspended. Returns a cancel function.
 */
export function after(context: BaseAudioContext, seconds: number, fn: () => void): () => void {
    const clock = context.createConstantSource();
    let cancelled = false;

    clock.offset.value = 0;
    clock.connect(context.destination);
    clock.onended = () => {
        clock.disconnect();
        if (!cancelled) fn();
    };
    clock.start();
    clock.stop(context.currentTime + Math.max(0, seconds));

    return () => {
        cancelled = true;
    };
}

/** Moves an `AudioParam` triple, with a fallback for engines without the params. */
export function setPosition(target: PannerNode | AudioListener, position: Vec3): void {
    if (target.positionX)
    {
        target.positionX.value = position.x;
        target.positionY.value = position.y;
        target.positionZ.value = position.z;
    }
    else
    {
        target.setPosition(position.x, position.y, position.z);
    }
}

export function createPanner(context: BaseAudioContext, options: SpatialOptions): PannerNode {
    const panner = context.createPanner();
    panner.panningModel = options.panningModel ?? "HRTF";
    panner.distanceModel = options.distanceModel ?? "inverse";
    panner.refDistance = options.refDistance ?? 1;
    panner.maxDistance = options.maxDistance ?? 10000;
    panner.rolloffFactor = options.rolloff ?? 1;
    setPosition(panner, options.position);
    return panner;
}

type Source = AudioBufferSourceNode | MediaElementAudioSourceNode;

/** One playing sound. Returned by `mixer.play()`. */
export class Voice {
    /** Volume of this voice. */
    readonly gain: GainNode;
    /** Present when the voice was played with `spatial`. */
    readonly panner: PannerNode | null;
    /** Called once when the voice ends or is stopped. */
    onended: (() => void) | null = null;

    private ended = false;
    private cancelStop: (() => void) | null = null;

    constructor(
        readonly context: BaseAudioContext,
        private readonly source: Source,
        private readonly element: HTMLAudioElement | null,
        output: AudioNode,
        panner: PannerNode | null,
        private readonly release: (voice: Voice) => void,
    ) {
        this.gain = context.createGain();
        this.panner = panner;

        source.connect(this.gain);
        if (panner)
        {
            this.gain.connect(panner);
            panner.connect(output);
        }
        else
        {
            this.gain.connect(output);
        }

        if (source instanceof AudioBufferSourceNode)
        {
            source.onended = () => this.finish();
        }
        else if (element)
        {
            element.onended = () => this.finish();
        }
    }

    /** True once the voice ended or was stopped. */
    get done(): boolean {
        return this.ended;
    }

    /** Current volume, mid-fade included. */
    get volume(): number {
        return valueAt(this.gain.gain, this.context.currentTime);
    }

    /** Volume the voice is heading to. */
    get target(): number {
        return targetOf(this.gain.gain);
    }

    /** Fades the volume. Cancels a pending `stop()` fade, which revives the voice. */
    fadeTo(volume: number, options: FadeOptions = {}): this {
        if (this.ended) return this;
        this.cancelStop?.();
        this.cancelStop = null;
        fade(this.gain.gain, this.context, volume, options.seconds ?? 1, options.curve);
        return this;
    }

    /** Stops, optionally after fading out. */
    stop(options: FadeOptions = {}): void {
        if (this.ended) return;
        const seconds = options.seconds ?? 0;
        if (seconds <= 0)
        {
            this.finish();
            return;
        }
        this.fadeTo(0, options);
        this.cancelStop = after(this.context, seconds, () => this.finish());
    }

    /** Moves a spatial voice. No-op for voices without `spatial`. */
    setPosition(position: Vec3): void {
        if (this.panner) setPosition(this.panner, position);
    }

    /** Starts the stream element. Used by the mixer once audio is unlocked. */
    resume(): void {
        this.element?.play().catch(() => { /* blocked or removed, nothing to do */ });
    }

    private finish(): void {
        if (this.ended) return;
        this.ended = true;
        this.cancelStop?.();

        if (this.source instanceof AudioBufferSourceNode)
        {
            this.source.onended = null;
            try { this.source.stop(); } catch { /* not started yet */ }
        }
        if (this.element)
        {
            this.element.onended = null;
            this.element.pause();
            this.element.removeAttribute("src");
            this.element.load();
        }

        this.source.disconnect();
        this.gain.disconnect();
        this.panner?.disconnect();
        this.release(this);
        this.onended?.();
    }
}
