import { translator, useTranslator } from '@papit/translator';

window.translator = translator;

window.onload = () => {

    translator.add({ id: "first", meta: { region: "GB", language: "en-UK" }, translations: { hello: "world", "variable {name}": "{name} poop" } });
    translator.add({ id: "second", translations: { hello: "second world", "variable {name}": "second {name} poop" } });
    translator.add({ id: "third", translations: { meta: { region: "GB", language: "en-UK" }, hello: "world 2", "variable 2 {name}": "{name} poop 2" } });
    translator.add({ id: "custom", url: "public/translations/custom.json" });

    const { t } = useTranslator();

    translator.change('first').then(() => {
        document.querySelector('[data-testid="hello"]').textContent = t('hello');
        document.querySelector('[data-testid="none"]').textContent = t('i dont have translation');
        document.querySelector('[data-testid="variable"]').textContent = t('variable {name}', { name: 'henry' });
    });
}