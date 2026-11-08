// synthesized sounds, so the demo needs no audio files

const RATE = 44100;

async function render(seconds, build) {
    const context = new OfflineAudioContext(2, seconds * RATE, RATE);
    build(context, seconds);
    return context.startRendering();
}

/** A short coin blip. */
export function blip() {
    return render(0.3, (context) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(880, 0);
        osc.frequency.setValueAtTime(1320, 0.08);
        gain.gain.setValueAtTime(0.25, 0);
        gain.gain.exponentialRampToValueAtTime(0.001, 0.3);
        osc.connect(gain).connect(context.destination);
        osc.start();
    });
}

/** A looping beep, for objects that make sound. */
export function beep(frequency, seconds = 1) {
    return render(seconds, (context) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, 0);
        gain.gain.linearRampToValueAtTime(0.3, 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, 0.25);
        osc.connect(gain).connect(context.destination);
        osc.start();
    });
}
