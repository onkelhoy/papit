import { translator } from '@papit/translator';
import '@papit/language-picker';

translator.add({ id: "en", translations: { meta: { language: "en", region: "GB" }, "language-picker": { label: "Language: {language}" } } });
translator.add({ id: "sv-SE", translations: { meta: { language: "sv", region: "SE" }, "language-picker": { label: "Språk: {language}" } } });
translator.add({ id: "fr-FR", translations: {} });
translator.change("en");
