# @papit/popover

a positioned overlay built on the native Popover API and CSS Anchor Positioning

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-1-foundations-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/popover.svg?logo=npm)](https://www.npmjs.com/package/@papit/popover)

---

## installation

```bash
npm install @papit/popover
```

### to use in **html**

```html
<script type="module" defer>
  import "@papit/popover";
</script>

<button popovertarget="my-pop">Open</button>
<pap-popover id="my-pop"> content goes here </pap-popover>
```

---

## usage

Connect any trigger element using the standard `popovertarget` attribute. The popover anchors itself automatically — no coordinate math needed.

### trigger actions

Control behaviour via `popovertargetaction` on the trigger:

| Value     | Behaviour                                                                 |
| --------- | ------------------------------------------------------------------------- |
| _(none)_  | Toggle open/closed on click                                               |
| `"show"`  | Open only                                                                 |
| `"hide"`  | Close only                                                                |
| `"hover"` | Open on mouse enter, close on leave (with safe hover zone across the gap) |

```html
<!-- hover trigger -->
<button popovertarget="tip" popovertargetaction="hover">Hover me</button>
<pap-popover id="tip" placement="top">tooltip text</pap-popover>
```

### placement

The `placement` attribute controls where the popover appears relative to its trigger. Single-axis values (`top`, `bottom`, `left`, `right`) resolve to their centered variant.

```
top-left     top / top-center     top-right

left-top                            right-top
left / left-center              right / right-center
left-bottom                         right-bottom

bottom-left  bottom / bottom-center  bottom-right
```

### multiple triggers

Any number of triggers can target the same popover. Each activation re-anchors it to the triggering element.

```html
<button popovertarget="ctx">Item A</button>
<button popovertarget="ctx">Item B</button>
<pap-popover id="ctx" placement="bottom-left">context menu</pap-popover>
```

### programmatic control

```ts
const popover = document.querySelector("pap-popover");

popover.show(triggerElement); // show, anchored to element
popover.hide(); // hide
popover.toggle(triggerElement); // toggle, anchored to element
```

---

## properties

| Property    | Type      | Default    | Description                                        |
| ----------- | --------- | ---------- | -------------------------------------------------- |
| `open`      | `boolean` | `false`    | Whether the popover is visible                     |
| `placement` | `string`  | `"bottom"` | Preferred placement relative to the trigger anchor |

## keyboard

| Key   | Behaviour     |
| ----- | ------------- |
| `Esc` | Close popover |

---

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core): Core utilities, decorators, and base component class

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).

```

```
