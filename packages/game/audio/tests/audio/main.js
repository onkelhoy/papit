import * as audio from '@papit/audio';

window.papitAudio = audio;

// offline helpers: constant buffers and rendering, so tests read real output samples
window.offline = (seconds = 2, rate = 8000) => new OfflineAudioContext(1, seconds * rate, rate);
window.constant = (context, value, seconds = 4) => {
    const buffer = context.createBuffer(1, seconds * context.sampleRate, context.sampleRate);
    buffer.getChannelData(0).fill(value);
    return buffer;
};
window.sampleAt = (rendered, time) => rendered.getChannelData(0)[Math.floor(time * rendered.sampleRate)];
