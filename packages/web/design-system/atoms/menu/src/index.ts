import { Menu } from './component.js';

import { MenuBar } from 'components/menubar';
import { MenuItem } from 'components/menuitem';

// export 
export * from "components/menubar";
export * from "components/menuitem";
export * from "./component";
export * from "./types";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-menu'))
{
    window.customElements.define('pap-menu', Menu);
}

if (!window.customElements.get('pap-menubar'))
{
    window.customElements.define('pap-menubar', MenuBar);
}

if (!window.customElements.get('pap-menuitem'))
{
    window.customElements.define('pap-menuitem', MenuItem);
}
