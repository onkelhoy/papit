import { Treeview } from './component.js';
import { Treeitem } from './components/treeitem';

// export 
export * from "./components/treeitem";
export * from "./component";
export * from "./types";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-treeview'))
{
    window.customElements.define('pap-treeview', Treeview);
}
if (!window.customElements.get('pap-treeitem'))
{
    window.customElements.define('pap-treeitem', Treeitem);
}
