import { Music } from 'ui/music/music.js';
import { Dejan } from './component.js';

// export 
export * from "./component";
export * from "./types";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('dejan-spel'))
{
    window.customElements.define('dejan-spel', Dejan);
}

if (!window.customElements.get('dejan-music'))
{
    window.customElements.define('dejan-music', Music);
}