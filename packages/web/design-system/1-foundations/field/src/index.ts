import { Field } from './component.js';

// export 
export * from "./component";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-field'))
{
    window.customElements.define('pap-field', Field);
}
