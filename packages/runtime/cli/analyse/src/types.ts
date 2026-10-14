/** A public class field, or a protected `@property` with an attribute, with what `@property({ type, attribute, reflect })` adds when decorated. */
export type Property = {
  name: string;
  /** TypeScript type as written, e.g. `"boolean"` or `"\"a\" | \"b\""`. */
  type: string;
  /**
   * The type as the checker resolves it, when `type` names an alias, an indexed access or the like,
   * e.g. `"\"primary\" | \"secondary\""` for `ButtonColor`. Absent when it reads the same as `type`.
   */
  resolvedType?: string;
  /** Observed attribute name; `false` when the property has none. Absent when not a `@property`. */
  attribute?: string | false;
  reflect?: boolean;
  /** The decorator's `type` converter, e.g. `"Boolean"`, `"Number"`. */
  converter?: string;
  /** Initializer as source text. */
  default?: string;
  description?: string;
  readonly?: boolean;
  /** `"protected"` for a protected `@property` with an attribute, the only kind kept; absent when public. */
  visibility?: "protected";
};

/** A public method. Lifecycle callbacks, `render` and private/protected members are left out. */
export type Method = {
  name: string;
  /** Parameters and return type as source text, e.g. `"(force?: boolean): void"`. */
  signature: string;
  description?: string;
};

/** An event dispatched with `dispatchEvent(new Event | CustomEvent(...))` or documented with `@fires`. */
export type Event = {
  name: string;
  kind: "Event" | "CustomEvent";
  /** The `detail` type as source text, for a `CustomEvent`. */
  detail?: string;
  description?: string;
};

/** A `<slot>` from the template or a `@slot` tag. `name` is `null` for the default slot. */
export type Slot = { name: string | null; description?: string };

/** A `part="..."` from the template or a `@csspart` tag. */
export type Part = { name: string; description?: string };

/** A CSS custom property found in the stylesheet or a `@cssprop` tag. */
export type CssVariable = {
  name: string;
  /** Declared in the stylesheet (`--x: ...`). */
  declared: boolean;
  /** Read in the stylesheet (`var(--x)`). */
  used: boolean;
  /** The declared value, or the `var()` fallback. */
  default?: string;
  description?: string;
};

/** Where an analysed class lives. `package` is set when it comes from another package. */
export type Source = { package?: string; file: string };

/** A platform base class (e.g. `HTMLElement`) that isn't analysed further. */
export type Builtin = { builtin: string };

/** A parent class not analysed yet: its name and the module specifier it's imported from (or the file it's declared in). */
export type Reference = { className: string; import: string };

/**
 * The analysis of one class. `analysePackage` nests the full parent chain in `extends`;
 * `analyseFile` leaves the parent as a `Reference`.
 */
export type Core = {
  /** From `customElements.define` or `HTMLElementTagNameMap`. Absent for base classes. */
  tagName?: string;
  className: string;
  description?: string;
  source: Source;
  properties: Property[];
  methods: Method[];
  events: Event[];
  /** Custom states added with `_internals.states.add(...)`. */
  states: string[];
  html: { slots: Slot[]; parts: Part[] };
  css: { variables: CssVariable[] };
  extends: Core | Reference | Builtin | null;
};

/** The `analyse.json` written for a package: every exported custom element class. */
export type PackageAnalysis = {
  name: string;
  version: string;
  elements: Core[];
};

export type AnalysePackageOptions = {
  /**
   * Reuse `analyse.json` of `extends` targets instead of re-analysing them.
   * In-repo packages are reused only when unchanged since it was written. A shipped one in `node_modules` is always reused.
   * @default true
   */
  reuse?: boolean;
};
