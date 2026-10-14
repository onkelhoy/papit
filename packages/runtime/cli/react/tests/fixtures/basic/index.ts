import { Fixture, FixtureDialog, FixtureDrawer, FixtureItem } from "./component";

export * from "./component";

customElements.define("fixture-el", Fixture);
customElements.define("fixture-item", FixtureItem);
customElements.define("fixture-dialog", FixtureDialog);
customElements.define("fixture-drawer", FixtureDrawer);
