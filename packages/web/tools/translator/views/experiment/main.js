// core
import "@papit/codeblock";

// component
import { effect } from '@papit/signals';
import { translator, useTranslator } from '@papit/translator';

window.onload = () => {
    console.log('[demo]: window loaded');

    const select = document.querySelector("select");
    const input = document.querySelector("input");
    const { t } = useTranslator();

    effect(() => {
        select.innerHTML = translator.list().map(lang =>
            `<option value="${lang.id}">${lang.meta?.language ?? lang.id}</option>`
        ).join('');

        const current = translator.current();
        if (current) select.value = current.id;
    });

    effect(() => {
        const lang = translator.current()
        if (!lang) return

        select.value = lang.id

        document.querySelectorAll('[data-t]').forEach(el => {
            el.textContent = t(el.dataset.t, { name: input.value })
        });
    });

    select.addEventListener('change', () => translator.change(select.value))

    input.addEventListener("input", () => {
        document.querySelectorAll('[data-t]').forEach(el => {
            el.textContent = t(el.dataset.t, { name: input.value })
        });
    })

    translator.add({
        id: "english",
        translations: {
            sentence1: "The quick brown fox jumps over the lazy dog",
            sentence2: "She sells seashells by the seashore",
            sentence3: "Welcome back, {name}!",
            sentence4: "Your order has been confirmed",
            sentence5: "Please select your preferred language"
        }
    });
    translator.add({
        id: "hungarian",
        translations: {
            sentence1: "A gyors barna róka átugrott a lusta kutya felett",
            sentence2: "Kagylókat árul a tengerparton",
            sentence3: "Üdv újra, {name}!",
            sentence4: "A rendelésed visszaigazolásra került",
            sentence5: "Kérjük válassza ki a kívánt nyelvet"
        }
    });

    translator.add({ id: "english2", url: "public/translations/en.json" });
    translator.add({ id: "hungarian2", url: "public/translations/hu.json" });
    translator.add({ id: "french", url: "public/translations/fr.json" });
    translator.add({ id: "swedish", url: "public/translations/se.json" });

    translator.change('english')  // set initial
}
