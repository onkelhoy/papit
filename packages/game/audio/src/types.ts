/** A point or direction in 3D space. */
export type Vec3 = { x: number; y: number; z: number };

/** Easing shape: maps progress 0..1 to 0..1. */
export type Shape = (t: number) => number;

/**
 * How a fade moves between two volumes.
 * A named curve, a custom shape function or a list of samples (0..1) spread over the fade.
 */
export type Curve =
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | "equal-power"
    | Shape
    | readonly number[];

export type MixerState = "locked" | "running" | "suspended" | "closed";

export type MixerOptions = {
    /** Use your own context, for example an `OfflineAudioContext` in tests. */
    context?: BaseAudioContext;
    /** Bus names created up front. Default `["music", "ambience", "sfx"]`. */
    buses?: readonly string[];
    /** Resume on the first pointer or key press. Default `true`. */
    autoUnlock?: boolean;
    /** Suspend while the page is hidden. Default `true`. */
    suspendWhenHidden?: boolean;
};

export type LoadOptions = {
    /** Stream through an `<audio>` element instead of decoding into memory. Use for long music. */
    stream?: boolean;
};

export type SpatialOptions = {
    position: Vec3;
    /** Distance where the volume starts to drop. Default `1`. */
    refDistance?: number;
    /** Distance after which the volume stops dropping. Default `10000`. */
    maxDistance?: number;
    /** How fast the volume drops. Default `1`. */
    rolloff?: number;
    distanceModel?: DistanceModelType;
    panningModel?: PanningModelType;
};

export type PlayOptions = {
    /** Bus name. Default `"sfx"`. */
    bus?: string;
    loop?: boolean;
    /** Start volume, 0..1+. Default `1`. */
    volume?: number;
    /** Fade in from silence over this many seconds. */
    fadeIn?: number;
    curve?: Curve;
    /** Seconds into the sound to start from. */
    offset?: number;
    /** Context time to start at, for starting stems in sync. Default now. */
    when?: number;
    /** Playback speed, buffers only. Default `1`. */
    rate?: number;
    /** Place the sound in 3D space. */
    spatial?: SpatialOptions;
};

export type FadeOptions = {
    /** Seconds. Default `1`. */
    seconds?: number;
    curve?: Curve;
};

export type TrackOptions = FadeOptions & {
    /** Volume the track fades to. Default `1`. */
    volume?: number;
    /** Volume per stem name, for layered music. Missing stems use `1`. */
    stems?: Record<string, number>;
    loop?: boolean;
};

/** A track is one sound id or a set of named stems played in sync. */
export type TrackSource = string | Record<string, string>;
