// import statements 
// system 
import { bind, CustomElement, html, property, query } from "@papit/web-component";

import "@papit/input";
import "@papit/confetti";
import "@papit/button";
import "@papit/icon";
import { Confetti } from "@papit/confetti";
import { Alphabet } from "alphabet";
// import "@papit/input";

// local 
import sheet from "./style.css" with { type: "css" };
import { Game } from "game";

export class Dejan extends CustomElement {
    static sheet = sheet;
    static fahSound: HTMLAudioElement;

    @property({ rerender: true }) mode: string = "start"
    @query("pap-confetti") confetti!: Confetti;

    private game?: Game;
    private name?: string;

    constructor() {
        super();

        if (!Dejan.fahSound)
        {
            Dejan.fahSound = new Audio("/fah.mp3");
            Dejan.fahSound.load();
        }
    }

    @bind
    private handleinput(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        this.name = val;

        if (/dejan/i.test(val))
        {
            Dejan.fahSound.pause();
            Dejan.fahSound.currentTime = 0;
            Dejan.fahSound.play();
        }

        else if (/henry/i.test(val))
        {
            this.confetti?.play({
                placement: "center"
            })
        }
    }

    @bind
    private handlestart() {
        this.mode = "game";

        setTimeout(() => {
            this.game = new Game(this.shadowRoot!, this.name!);
        }, 1000);
    }

    render() {
        if (this.mode === "start")
        {
            return html`
                <pap-confetti></pap-confetti>
                <div class="wrapper">
                    <div>
                        <pap-input @input="${this.handleinput}" placeholder="Bob Lazar"></pap-input>
                        <pap-button @click="${this.handlestart}">Go</pap-button>
                    </div>
                </div>
            `
        }

        if (this.mode === "game")
        {
            return html`
                <canvas>no canvas support loser</canvas>
            `
        }


        return "hello"
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-dejan": Dejan;
    }
}