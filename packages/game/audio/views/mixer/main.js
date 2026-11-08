import "@papit/button";
import "@papit/switch";
import { AudioMixer } from "@papit/audio";
import { blip } from "./sounds.js";

const mixer = new AudioMixer();
window.mixer = mixer;

const state = document.querySelector("#state");
state.value = mixer.state;
mixer.addEventListener("statechange", () => state.value = mixer.state);

await Promise.all([
    mixer.load("forest", "public/songs/cara-a-cara.mp3", { stream: true }),
    mixer.load("desert", "public/songs/dust-and-steel.mp3", { stream: true }),
    mixer.load("cave", "public/songs/guardians-watch.mp3", { stream: true }),
]);
mixer.add("blip", await blip());

const seconds = document.querySelector("#seconds");
const curve = document.querySelector("#curve");
seconds.addEventListener("input", () => seconds.nextElementSibling.value = seconds.value);

document.querySelector("#biomes").addEventListener("click", (event) => {
    const button = event.target.closest("[data-biome]");
    if (!button) return;
    const options = { seconds: Number(seconds.value), curve: curve.value };
    if (button.dataset.biome) mixer.music.play(button.dataset.biome, options);
    else mixer.music.stop(options);
});

document.querySelector("#sfx").addEventListener("click", () => mixer.play("blip", { bus: "sfx" }));

for (const slider of document.querySelectorAll("[data-bus]"))
{
    const bus = slider.dataset.bus === "master" ? mixer.master : mixer.bus(slider.dataset.bus);
    slider.addEventListener("input", () => bus.fadeTo(Number(slider.value), { seconds: 0.05 }));
}

document.querySelector("#mute").addEventListener("change", (event) => {
    if (event.currentTarget.checked) mixer.bus("music").mute({ seconds: 0.3 });
    else mixer.bus("music").unmute({ seconds: 0.3 });
});
