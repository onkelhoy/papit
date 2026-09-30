# findTarget

Finds an element related to `element`: the one a selector names, or the nearest ancestor that qualifies. Used by `@query({ outside })` and the `@context` provider lookup.

```ts
findTarget(
    element: HTMLElement,
    query?: string | (() => string),  // a function is called with element as `this`
    finder?: (target: HTMLElement) => HTMLElement | null,
): HTMLElement | null
```

1. If `query` matches **exactly one** element in `element`'s root node (the document, or the shadow root it lives in), that element is returned, whether it is an ancestor or not.
2. Otherwise it walks up from the parent, through shadow hosts (see [nextParent](./NextParent.md)), and returns the first element `finder` accepts. Without a `finder`, the first that matches `query`.
3. `null` if nothing qualifies, or if there is neither a `query` nor a `finder`.

```ts
// the element named by aria-controls (a single match), else the nearest .zone around me
const id = button.getAttribute("aria-controls");
findTarget(button, id ? `#${CSS.escape(id)}` : ".zone");

// any ancestor that has a `slide` property
findTarget(gallery, undefined, target => "slide" in target ? target : null);
```

`element` itself is never a candidate of the walk.
