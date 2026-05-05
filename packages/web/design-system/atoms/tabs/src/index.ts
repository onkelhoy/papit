import { Tabs } from "./component.js";
import { Tab } from "./components/tab/component.js";
import { TabPanel } from "./components/panel/component.js";

// export 
export * from "./component";
export * from "./components/tab/component.js";
export * from "./components/panel/component.js";

// Register the element with the browser

if (!window.customElements)
{
    throw new Error("Custom Elements not supported");
}

if (!window.customElements.get("pap-tabs"))
{
    window.customElements.define("pap-tabs", Tabs);
}

if (!window.customElements.get("pap-tab"))
{
    window.customElements.define("pap-tab", Tab);
}

if (!window.customElements.get("pap-tabpanel"))
{
    window.customElements.define("pap-tabpanel", TabPanel);
}