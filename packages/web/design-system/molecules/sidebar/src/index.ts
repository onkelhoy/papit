import { Sidebar } from './component.js';

// export 
export * from "./component.js";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-sidebar'))
{
    window.customElements.define('pap-sidebar', Sidebar);
}
