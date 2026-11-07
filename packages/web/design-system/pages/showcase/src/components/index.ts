import { ShowcaseApi } from "./api";
import { ShowcaseAssets } from "./assets";
import { ShowcaseTranslations } from "./translations";

export * from "./api";
export * from "./assets";
export * from "./translations";

if (!window.customElements.get("pap-showcase-api")) window.customElements.define("pap-showcase-api", ShowcaseApi);
if (!window.customElements.get("pap-showcase-assets")) window.customElements.define("pap-showcase-assets", ShowcaseAssets);
if (!window.customElements.get("pap-showcase-translations")) window.customElements.define("pap-showcase-translations", ShowcaseTranslations);
