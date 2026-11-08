import { after, type Voice } from "./voice";
import type { FadeOptions, PlayOptions, TrackOptions, TrackSource } from "./types";

/** What a track needs from the mixer. */
export interface Player {
    readonly context: BaseAudioContext;
    play(id: string, options?: PlayOptions): Voice;
}

/** A playing piece of music: one sound or several stems started in sync. */
export class Track {
    /** Stem voices by name. A single-sound track has one stem, `"main"`. */
    readonly stems = new Map<string, Voice>();

    private cancelStop: (() => void) | null = null;
    private stopped = false;

    constructor(readonly key: string, player: Player, source: TrackSource, bus: string, options: TrackOptions) {
        const sources = typeof source === "string" ? { main: source } : source;
        // a small lead so every stem gets scheduled before the start time
        const when = player.context.currentTime + 0.05;

        for (const name in sources)
        {
            const voice = player.play(sources[name], { bus, loop: options.loop ?? true, volume: 0, when });
            this.stems.set(name, voice);
        }
        this.fadeTo(options.volume ?? 1, options);
    }

    get done(): boolean {
        return this.stopped;
    }

    /** One stem's voice, to fade layers in and out. */
    stem(name: string): Voice | undefined {
        return this.stems.get(name);
    }

    /** Fades every stem; `stems` sets per-stem volumes (times `volume`). Cancels a pending stop. */
    fadeTo(volume: number, options: FadeOptions & { stems?: Record<string, number> } = {}): this {
        if (this.stopped) return this;
        this.cancelStop?.();
        this.cancelStop = null;
        for (const [name, voice] of this.stems)
        {
            voice.fadeTo(volume * (options.stems?.[name] ?? 1), options);
        }
        return this;
    }

    stop(options: FadeOptions = {}): void {
        if (this.stopped) return;
        const seconds = options.seconds ?? 0;
        if (seconds <= 0)
        {
            this.finish();
            return;
        }
        this.fadeTo(0, options);
        const context = this.stems.values().next().value?.context;
        if (!context)
        {
            this.finish();
            return;
        }
        this.cancelStop = after(context, seconds, () => this.finish());
    }

    private finish(): void {
        this.stopped = true;
        this.cancelStop?.();
        for (const voice of this.stems.values()) voice.stop();
    }
}

function keyOf(source: TrackSource): string {
    if (typeof source === "string") return source;
    return Object.keys(source).sort().map(name => `${name}=${source[name]}`).join("&");
}

/**
 * Background music that crossfades between tracks, e.g. one per biome.
 * `play()` with the playing track only updates its volume.
 */
export class Music {
    private active: Track | null = null;
    // tracks fading out, kept so walking back mid-fade revives them
    private leaving = new Map<string, Track>();

    constructor(private readonly player: Player, readonly bus = "music") { }

    /** The track playing or fading in. */
    get current(): Track | null {
        return this.active;
    }

    /** Crossfades to `source`. Default fade: 2 seconds, equal-power. */
    play(source: TrackSource, options: TrackOptions = {}): Track {
        const settings: TrackOptions = { seconds: 2, curve: "equal-power", ...options };
        const key = keyOf(source);

        if (this.active?.key === key && !this.active.done)
        {
            return this.active.fadeTo(settings.volume ?? 1, settings);
        }

        this.leave(settings);

        const revived = this.leaving.get(key);
        if (revived && !revived.done)
        {
            this.leaving.delete(key);
            this.active = revived.fadeTo(settings.volume ?? 1, settings);
            return revived;
        }

        this.active = new Track(key, this.player, source, this.bus, settings);
        return this.active;
    }

    /** Fades the current track out. */
    stop(options: FadeOptions = {}): void {
        this.leave({ seconds: 2, curve: "equal-power", ...options });
    }

    /** Stops everything right away. */
    clear(): void {
        this.active?.stop();
        this.active = null;
        for (const track of this.leaving.values()) track.stop();
        this.leaving.clear();
    }

    private leave(options: FadeOptions): void {
        for (const [key, track] of this.leaving)
        {
            if (track.done) this.leaving.delete(key);
        }
        if (!this.active) return;
        this.active.stop(options);
        if (!this.active.done) this.leaving.set(this.active.key, this.active);
        this.active = null;
    }
}
