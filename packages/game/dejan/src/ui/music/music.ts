// import statements 
// system 
import { bind, CustomElement, html, property, query } from "@papit/web-component";

import "@papit/button";
import "@papit/icon";

// local 
import sheet from "./style.css" with { type: "css" };
import { Game } from "game/game";

export class Music extends CustomElement {
    static sheet = sheet;
    static songs: HTMLAudioElement[] = [];
    private static ready = 0;
    private static maxsongs = 4;
    private static _loaded = false;
    static get loaded() {
        return this._loaded;
    }
    private currentTrack = 0;

    @property({ type: Boolean, rerender: true }) playing = false;
    @property({
        type: Number,
        after(this: Music) {
            if (!Music.songs[this.currentTrack] || Music.songs[this.currentTrack].error) return;
            Music.songs[this.currentTrack].volume = this.volume;
        }
    }) volume = 1;

    constructor() {
        super();

        if (Music.songs.length !== 0) return;

        for (let i = 1; i < 5; i++)
        {
            const audio = new Audio(`/music${i}.mp3`);
            audio.onloadeddata = () => {
                Music.ready++;
                Music._loaded = Music.ready === Music.maxsongs;

                if (Music.loaded)
                {
                    this.play(Math.round(Math.random() * 3));
                }
            };
            audio.onended = () => {
                this.currentTrack = (this.currentTrack + 1) % Music.songs.length
                setTimeout(() => {
                    this.play();
                }, 1000);
            }
            audio.onerror = () => {
                Music.maxsongs--;
            };
            audio.load();
            Music.songs.push(audio);
        }
    }

    @bind
    private toggleplay() {

        if (this.playing)
        {
            this.playing = false;
            return;
        }

        this.play();
    }

    public play(song: number = this.currentTrack, attempt: null | number = null) {
        // if (!Music.loaded) return;

        if (!Music.songs[this.currentTrack]?.error) 
        {
            Music.songs[this.currentTrack].pause();
        }

        this.playing = true;
        if (Music.songs[song].error) 
        {
            if (attempt !== null && attempt === song) 
            {
                throw new Error("songs could not be loaded");
            }
            this.play(song + 1 % 4, attempt ?? song);
            return;
        }

        Music.songs[song].volume = this.volume;
        Music.songs[song].play();

        this.currentTrack = song;
    }

    render() {
        return html`
            <pap-button variant="clear" @click="${this.toggleplay}">
                <pap-icon name="${this.playing ? 'pause' : 'play'}"></pap-icon>
            </pap-button>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "dejan-music": Music;
    }
}