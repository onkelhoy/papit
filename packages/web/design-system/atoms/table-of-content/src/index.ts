import { TableOfContent } from './component.js';

// export 
export * from "./component";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-table-of-content'))
{
    window.customElements.define('pap-table-of-content', TableOfContent);
}
