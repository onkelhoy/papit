import { test, expect } from '@playwright/test';

declare global {
    interface Window {
        papitAudio: typeof import('@papit/audio');
        offline(seconds?: number, rate?: number): OfflineAudioContext;
        constant(context: BaseAudioContext, value: number, seconds?: number): AudioBuffer;
        sampleAt(rendered: AudioBuffer, time: number): number;
        live: import('@papit/audio').AudioMixer;
    }
}

test.beforeEach(async ({ page }) => {
    await page.goto('tests/audio/');
    await page.waitForFunction(() => !!window.papitAudio);
});

test.describe("@papit/audio fades", () => {
    test("bus volume and linear fade reach their values", async ({ page }) => {
        const [half, mid, end] = await page.evaluate(async () => {
            const context = window.offline(2);
            const mixer = new window.papitAudio.AudioMixer({ context });
            mixer.add("one", window.constant(context, 1));
            mixer.play("one");
            mixer.bus("sfx").volume = 0.5;
            mixer.master.fadeTo(0, { seconds: 1, curve: "linear" });
            const rendered = await context.startRendering();
            return [window.sampleAt(rendered, 0.01), window.sampleAt(rendered, 0.5), window.sampleAt(rendered, 1.5)];
        });
        expect(half).toBeCloseTo(0.5, 1);
        expect(mid).toBeCloseTo(0.25, 1);
        expect(end).toBeCloseTo(0, 2);
    });

    test("equal-power crossfade keeps power: sin + cos at the midpoint", async ({ page }) => {
        const [mid, end] = await page.evaluate(async () => {
            const context = window.offline(2);
            const mixer = new window.papitAudio.AudioMixer({ context });
            mixer.add("one", window.constant(context, 1));
            const a = mixer.play("one");
            const b = mixer.play("one", { volume: 0 });
            mixer.crossfade(a, b, { seconds: 1 });
            const rendered = await context.startRendering();
            return [window.sampleAt(rendered, 0.5), window.sampleAt(rendered, 1.5)];
        });
        expect(mid).toBeCloseTo(Math.SQRT2, 1);
        expect(end).toBeCloseTo(1, 2);
    });

    test("interrupting a fade continues from the current value", async ({ page }) => {
        const values = await page.evaluate(() => {
            const { fade, valueAt } = window.papitAudio;
            const context = window.offline(1);
            const gain = context.createGain();
            fade(gain.gain, context, 0, 1, "linear");
            const start = valueAt(gain.gain, 0);
            const later = valueAt(gain.gain, 0.25);
            return [start, later];
        });
        expect(values[0]).toBeCloseTo(1, 5);
        expect(values[1]).toBeCloseTo(0.75, 5);
    });

    test("custom sample curves interpolate", async ({ page }) => {
        const value = await page.evaluate(() => window.papitAudio.toShape([0, 1, 0], true)(0.25));
        expect(value).toBeCloseTo(0.5, 5);
    });
});

test.describe("@papit/audio voices and music", () => {
    test("stop with a fade ends the voice", async ({ page }) => {
        const [done, sample] = await page.evaluate(async () => {
            const context = window.offline(2);
            const mixer = new window.papitAudio.AudioMixer({ context });
            mixer.add("one", window.constant(context, 1));
            const voice = mixer.play("one", { loop: true });
            voice.stop({ seconds: 0.5 });
            const rendered = await context.startRendering();
            await new Promise(resolve => setTimeout(resolve, 50));
            return [voice.done, window.sampleAt(rendered, 1)];
        });
        expect(done).toBe(true);
        expect(sample).toBeCloseTo(0, 2);
    });

    test("music crossfades to the new track and revives a leaving one", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const context = window.offline(3);
            const mixer = new window.papitAudio.AudioMixer({ context });
            mixer.add("forest", window.constant(context, 1));
            mixer.add("desert", window.constant(context, 2));
            const forest = mixer.music.play("forest", { seconds: 0.5 });
            mixer.music.play("desert", { seconds: 0.5 });
            const back = mixer.music.play("forest", { seconds: 0.5 });
            const same = mixer.music.play("forest", { seconds: 0.5 });
            const rendered = await context.startRendering();
            return { revived: forest === back && back === same, end: window.sampleAt(rendered, 2.5) };
        });
        expect(result.revived).toBe(true);
        expect(result.end).toBeCloseTo(1, 2);
    });

    test("stems play in sync with their own volumes", async ({ page }) => {
        const end = await page.evaluate(async () => {
            const context = window.offline(2);
            const mixer = new window.papitAudio.AudioMixer({ context });
            mixer.add("pads", window.constant(context, 1));
            mixer.add("drums", window.constant(context, 1));
            mixer.music.play({ pads: "pads", drums: "drums" }, { seconds: 0, stems: { drums: 0.5 } });
            const rendered = await context.startRendering();
            return window.sampleAt(rendered, 1);
        });
        expect(end).toBeCloseTo(1.5, 2);
    });

    test("unknown sound throws", async ({ page }) => {
        const message = await page.evaluate(() => {
            const mixer = new window.papitAudio.AudioMixer({ context: window.offline(1) });
            try { mixer.play("nope"); } catch (error) { return (error as Error).message; }
            return "";
        });
        expect(message).toContain("unknown sound");
    });

    test("spatial voices get quieter with distance", async ({ page }) => {
        const ratio = await page.evaluate(async () => {
            const render = async (distance: number) => {
                const context = window.offline(1);
                const mixer = new window.papitAudio.AudioMixer({ context });
                mixer.add("one", window.constant(context, 1));
                mixer.setListener({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
                mixer.play("one", { spatial: { position: { x: 0, y: 0, z: -distance }, panningModel: "equalpower" } });
                const rendered = await context.startRendering();
                return window.sampleAt(rendered, 0.5);
            };
            return (await render(1)) / (await render(10));
        });
        expect(ratio).toBeCloseTo(10, 0);
    });
});

test.describe("@papit/audio live context", () => {
    test("unlocks on a gesture and closes", async ({ page }) => {
        await page.evaluate(() => { window.live = new window.papitAudio.AudioMixer(); });
        await page.getByTestId("gesture").click();
        // headless Firefox on CI has no audio device, so the context may stay suspended
        await page.waitForFunction(() => window.live.state !== "locked");
        const state = await page.evaluate(async () => {
            await window.live.close();
            return [window.live.state, (window.live.context as AudioContext).state];
        });
        expect(state).toEqual(["closed", "closed"]);
    });
});
