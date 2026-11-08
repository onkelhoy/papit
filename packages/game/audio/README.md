# @papit/audio

Web Audio mixer for games: buses, layered music, crossfades and 3D sound, working on iOS.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/audio.svg?logo=npm)](https://www.npmjs.com/package/@papit/audio)

---

# Installation

```bash
npm install @papit/audio
```

# Usage

```typescript
import { AudioMixer } from "@papit/audio";

const mixer = new AudioMixer(); // unlocks itself on the first tap or key press

await mixer.load("forest", "/music/forest.mp3", { stream: true });
await mixer.load("coin", "/sfx/coin.wav");

mixer.music.play("forest");            // 2 s equal-power crossfade from whatever played
mixer.play("coin", { bus: "sfx" });    // fire and forget
```

Switch biome music. Walking back mid-fade revives the old track instead of restarting it:

```typescript
mixer.music.play("cave", { seconds: 4, curve: "ease-in-out" });
mixer.music.stop({ seconds: 1 });
```

Layered music, stems start in sync and each has its own volume:

```typescript
const track = mixer.music.play({ base: "battle-drums", lead: "battle-lead" }, { stems: { lead: 0 } });
track.fadeTo(1, { stems: { lead: 1 }, seconds: 2 }); // bring in the lead
```

3D sound:

```typescript
const fire = mixer.play("crackle", { loop: true, bus: "ambience", spatial: { position: { x: 4, y: 0, z: -2 } } });
mixer.setListener(player.position, cameraForward); // every frame
fire.setPosition({ x: 5, y: 0, z: -2 });
```

Buses:

```typescript
mixer.bus("music").fadeTo(0.5, { seconds: 1 });
mixer.bus("sfx").mute();
mixer.master.volume = 0.8;
```

# API

## AudioMixer

```typescript
new AudioMixer(options?: MixerOptions)
```

One `AudioContext` for the whole game. Extends `EventTarget`, fires `statechange`.

| Option | Type | Default | Description |
|---|---|---|---|
| `context` | `BaseAudioContext` | new `AudioContext` | Bring your own, e.g. `OfflineAudioContext` in tests |
| `buses` | `string[]` | `["music", "ambience", "sfx"]` | Buses created up front |
| `autoUnlock` | `boolean` | `true` | Resume on the first pointer or key press |
| `suspendWhenHidden` | `boolean` | `true` | Suspend while the page is hidden |

| Member | Description |
|---|---|
| `state` | `"locked" \| "running" \| "suspended" \| "closed"` |
| `master` | The master `Bus` |
| `music` | `Music` player on the `music` bus |
| `bus(name)` | Gets a bus, creating it on first use |
| `unlock()` | Resumes audio, call inside a user gesture |
| `load(id, url, { stream? })` | Decodes into memory, or streams through `<audio>` with `stream: true`. Rejects on failure |
| `add(id, buffer)` / `has(id)` | Register a ready `AudioBuffer` / check an id |
| `play(id, options?)` | Returns a `Voice`. Before unlock it waits and starts on unlock |
| `crossfade(from, to, options?)` | Fades `from` out and `to` in, 1 s equal-power by default |
| `setListener(position, forward?, up?)` | Places the listener for 3D sound |
| `close()` | Stops every voice, removes listeners, closes the context |

### PlayOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `bus` | `string` | `"sfx"` | Bus to play on |
| `loop` | `boolean` | `false` | |
| `volume` | `number` | `1` | Start volume |
| `fadeIn` | `number` | | Seconds to fade in from silence |
| `curve` | `Curve` | | Fade-in curve |
| `offset` | `number` | `0` | Seconds into the sound |
| `when` | `number` | now | Context time to start at |
| `rate` | `number` | `1` | Playback speed, buffers only |
| `spatial` | `SpatialOptions` | | `position`, `refDistance` (1), `maxDistance` (10000), `rolloff` (1), `distanceModel`, `panningModel` |

## Bus, Voice, Track

All three share `fadeTo(volume, { seconds?, curve? })`, `volume` (current, mid-fade included) and `target`.

| Class | Extra members |
|---|---|
| `Bus` | `mute(fade?)`, `unmute(fade?)`, `muted` |
| `Voice` | `stop(fade?)`, `done`, `setPosition(vec3)`, `gain`, `panner` |
| `Track` | `stop(fade?)`, `stem(name)`, `fadeTo` also takes `stems` |

## Music

| Member | Description |
|---|---|
| `play(source, options?)` | Crossfades to a sound id or `{ stemName: id }`. If it is already playing it only fades to the new volume. Options: `seconds` (2), `curve` (`equal-power`), `volume`, `stems`, `loop` (`true`) |
| `stop(fade?)` | Fades the current track out, 2 s by default |
| `clear()` | Stops everything right away |
| `current` | Track playing or fading in |

## Curves

`"linear" | "ease-in" | "ease-out" | "ease-in-out" | "equal-power"`, a function `(t) => number`, or an array of samples 0..1 spread over the fade. Lower level: `fade(param, context, to, seconds, curve)`, `valueAt(param, time)`, `targetOf(param)`.

# Design notes

- Fades are scheduled on the audio thread with `setValueCurveAtTime`, no per-frame JS.
- Long music should use `stream: true`: decoding a 3-minute track costs tens of MB.
- iOS: the mixer sets `navigator.audioSession.type = "playback"` when available, so sound plays with the silent switch on.
- Demos: `views/mixer` (buses and fades) and `views/world` (walk between biomes with 3D emitters). Music is from the cowboy and arrow-warfare games, effects are generated.

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

# Related

- [@papit/game-engine](https://github.com/onkelhoy/papit/tree/main/packages/game/engine)
  2D and 3D game engine, used by the world demo.
