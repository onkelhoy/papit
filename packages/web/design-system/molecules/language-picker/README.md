# @papit/language-picker

Language menu for @papit/translator: lists the loaded languages with their names and round country flags, and switches the active language.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-molecules-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/language-picker.svg?logo=npm)](https://www.npmjs.com/package/@papit/language-picker)

---

# Installation

```bash
npm install @papit/language-picker
```

---

# Usage

```html
<script type="module">
    import { translator } from "@papit/translator";
    import "@papit/language-picker";

    translator.add({ id: "en", url: "/en.json" });
    translator.add({ id: "sv-SE", url: "/sv-SE.json" });
    translator.change("en");
</script>

<pap-language-picker></pap-language-picker>
```

The picker follows `translator`: languages added later show up, and a `translator.change` from elsewhere updates the trigger.

## Names and flags

- **Name**: `Intl.DisplayNames` names each language in the current one ("Swedish" in English, "svenska" in Swedish), from `meta.language`, else the id.
- **Flag**: `meta.region`, else the region in the id (`sv-SE` → `SE`), as an emoji flag through `pap-icon flag`. The emoji is zoomed and cropped to a circle. Without a region the trigger shows a globe.

---

# API

| Attribute | Property | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `placement` | `placement` | `string` | `"bottom-right"` | where the menu opens, as `pap-menu` |
| — | `options` | `LanguageOption[]` | — | read-only: the languages as shown (`id`, `name`, `region`) |

| Event | Description |
| --- | --- |
| `change` | the language changed through the picker |

| CSS part / property | Description |
| --- | --- |
| `trigger` | the round flag button |
| `flag` | the round flag wrappers |
| `--language-picker-flag-size` | flag diameter, default `var(--space-6, 24px)` |

`languageRegion(language: LanguageJson): string | undefined` is exported for reuse.

---

# Accessibility

The trigger is a `pap-button` opening a `pap-menu` (WAI-ARIA [menu button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)), labelled "Language: <current>" through `language-picker.label` in the translations. Flags are decorative (`aria-hidden`); each item carries `lang` and the current one `aria-current`.

---

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

# Related

- [@papit/translator](https://github.com/onkelhoy/papit/tree/main/packages/web/tools/translator): the language store it drives
- [@papit/menu](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/atoms/menu), [@papit/icon](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/icon)
- [@papit/theme-picker](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/theme-picker): the same pattern for light and dark
