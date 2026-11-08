import { Bus } from "./bus";
import { Music, type Track } from "./music";
import { Voice, createPanner, setPosition } from "./voice";
import type { FadeOptions, LoadOptions, MixerOptions, MixerState, PlayOptions, Vec3 } from "./types";

type Sound =
    | { kind: "buffer"; buffer: AudioBuffer }
    | { kind: "stream"; url: string };

type Fadable = Voice | Track;

const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

/**
 * One audio output for the whole game: buses, voices, music and 3D sound.
 * Dispatches `statechange` when `state` changes.
 */
export class AudioMixer extends EventTarget {
    readonly context: BaseAudioContext;
    readonly master: Bus;
    /** Background music on the `music` bus. */
    readonly music: Music;

    private buses = new Map<string, Bus>();
    private sounds = new Map<string, Sound>();
    private voices = new Set<Voice>();
    private unlocked: boolean;
    private closed = false;
    private autoUnlock: boolean;
    private suspendWhenHidden: boolean;

    constructor(options: MixerOptions = {}) {
        super();
        this.context = options.context ?? new AudioContext({ latencyHint: "interactive" });
        // an offline context renders on demand and never needs a gesture
        this.unlocked = !(this.context instanceof AudioContext) || this.context.state === "running";
        this.autoUnlock = options.autoUnlock ?? true;
        this.suspendWhenHidden = options.suspendWhenHidden ?? true;

        this.master = new Bus("master", this.context, this.context.destination);
        for (const name of options.buses ?? ["music", "ambience", "sfx"]) this.bus(name);
        this.music = new Music(this, "music");

        // iOS mutes web audio on the silent switch unless the session says "playback"
        const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
        if (session) session.type = "playback";

        this.context.onstatechange = this.handleStatechange;
        if (!this.unlocked && this.autoUnlock)
        {
            for (const type of UNLOCK_EVENTS) window.addEventListener(type, this.handleGesture, true);
        }
        if (this.suspendWhenHidden) document.addEventListener("visibilitychange", this.handleVisibilitychange);
    }

    get state(): MixerState {
        if (this.closed) return "closed";
        if (!this.unlocked) return "locked";
        return this.context.state === "running" ? "running" : "suspended";
    }

    /** Gets a bus, creating it on first use. */
    bus(name: string): Bus {
        let bus = this.buses.get(name);
        if (!bus)
        {
            bus = new Bus(name, this.context, this.master.gain);
            this.buses.set(name, bus);
        }
        return bus;
    }

    /**
     * Resumes audio. Call it inside a user gesture (tap, click, key).
     * With `autoUnlock` the mixer does this on the first gesture by itself.
     */
    async unlock(): Promise<void> {
        if (this.closed || !(this.context instanceof AudioContext)) return;
        const context = this.context;

        // old iOS only unlocks after something plays inside the gesture
        const blip = context.createBufferSource();
        blip.buffer = context.createBuffer(1, 1, context.sampleRate);
        blip.connect(context.destination);
        blip.start();

        const resumed = context.resume();
        this.unlocked = true;
        this.removeGestureListeners();
        for (const voice of this.voices) voice.resume();
        await resumed;
        this.dispatchEvent(new Event("statechange"));
    }

    /** Loads a sound under `id`. Rejects when fetching or decoding fails. */
    async load(id: string, url: string, options: LoadOptions = {}): Promise<void> {
        if (options.stream)
        {
            this.sounds.set(id, { kind: "stream", url });
            return;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`@papit/audio: could not load "${url}" (${response.status})`);
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.sounds.set(id, { kind: "buffer", buffer });
    }

    /** Registers an already decoded or generated buffer under `id`. */
    add(id: string, buffer: AudioBuffer): void {
        this.sounds.set(id, { kind: "buffer", buffer });
    }

    has(id: string): boolean {
        return this.sounds.has(id);
    }

    /** Plays a loaded sound. Before unlock it waits and starts on unlock. */
    play(id: string, options: PlayOptions = {}): Voice {
        const sound = this.sounds.get(id);
        if (!sound) throw new Error(`@papit/audio: unknown sound "${id}", load it first`);
        if (this.closed) throw new Error("@papit/audio: mixer is closed");

        const context = this.context;
        const output = this.bus(options.bus ?? "sfx").gain;
        const panner = options.spatial ? createPanner(context, options.spatial) : null;
        const release = (voice: Voice) => this.voices.delete(voice);
        const when = options.when ?? context.currentTime;
        let voice: Voice;

        if (sound.kind === "buffer")
        {
            const source = context.createBufferSource();
            source.buffer = sound.buffer;
            source.loop = options.loop ?? false;
            source.playbackRate.value = options.rate ?? 1;
            voice = new Voice(context, source, null, output, panner, release);
            source.start(when, options.offset ?? 0);
        }
        else
        {
            if (!(context instanceof AudioContext)) throw new Error("@papit/audio: streaming needs a live AudioContext");
            const element = new Audio();
            element.crossOrigin = "anonymous";
            element.preload = "auto";
            element.loop = options.loop ?? false;
            element.src = sound.url;
            if (options.offset) element.currentTime = options.offset;
            const source = context.createMediaElementSource(element);
            voice = new Voice(context, source, element, output, panner, release);
            if (this.unlocked) voice.resume();
        }

        this.voices.add(voice);
        const volume = options.volume ?? 1;
        if (options.fadeIn)
        {
            voice.fadeTo(0, { seconds: 0 });
            voice.fadeTo(volume, { seconds: options.fadeIn, curve: options.curve });
        }
        else
        {
            voice.fadeTo(volume, { seconds: 0 });
        }
        return voice;
    }

    /**
     * Fades `from` out (then stops it) while `to` fades in to `volume`.
     * Default: 1 second, equal-power.
     */
    crossfade(from: Fadable | null, to: Fadable, options: FadeOptions & { volume?: number } = {}): void {
        const settings: FadeOptions = { seconds: 1, curve: "equal-power", ...options };
        from?.stop(settings);
        to.fadeTo(options.volume ?? 1, settings);
    }

    /** Places the listener (the camera or player) for 3D sound. */
    setListener(position: Vec3, forward?: Vec3, up: Vec3 = { x: 0, y: 1, z: 0 }): void {
        const listener = this.context.listener;
        setPosition(listener, position);
        if (!forward) return;
        if (listener.forwardX)
        {
            listener.forwardX.value = forward.x;
            listener.forwardY.value = forward.y;
            listener.forwardZ.value = forward.z;
            listener.upX.value = up.x;
            listener.upY.value = up.y;
            listener.upZ.value = up.z;
        }
        else
        {
            listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
        }
    }

    /** Stops every voice, removes listeners and closes the context. */
    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        this.music.clear();
        for (const voice of [...this.voices]) voice.stop();
        this.removeGestureListeners();
        document.removeEventListener("visibilitychange", this.handleVisibilitychange);
        this.context.onstatechange = null;
        if (this.context instanceof AudioContext) await this.context.close();
        this.dispatchEvent(new Event("statechange"));
    }

    private removeGestureListeners(): void {
        for (const type of UNLOCK_EVENTS) window.removeEventListener(type, this.handleGesture, true);
    }

    private handleGesture = (): void => {
        this.unlock().catch(() => { /* retried on the next gesture */ });
    };

    private handleStatechange = (): void => {
        this.dispatchEvent(new Event("statechange"));
    };

    private handleVisibilitychange = (): void => {
        if (!(this.context instanceof AudioContext) || !this.unlocked || this.closed) return;
        if (document.hidden) this.context.suspend().catch(() => { });
        else this.context.resume().catch(() => { });
    };
}
