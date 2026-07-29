import { Checkbox } from './component.js';

// export 
export * from "./component";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-checkbox'))
{
    window.customElements.define('pap-checkbox', Checkbox);
}
