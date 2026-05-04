import { AccordionHeader } from 'components/header/component.js';
import { AccordionPanel } from 'components/panel/component.js';
import { Accordion } from './component.js';

// export 
export * from "./component";
export * from "./types";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-accordion'))
{
    window.customElements.define('pap-accordion', Accordion);
}

if (!window.customElements.get('pap-accordion-header'))
{
    window.customElements.define('pap-accordion-header', AccordionHeader);
}

if (!window.customElements.get('pap-accordion-panel'))
{
    window.customElements.define('pap-accordion-panel', AccordionPanel);
}
