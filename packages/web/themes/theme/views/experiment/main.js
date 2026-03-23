window.onload = () => {
    document.querySelector("select").onchange = (e) => {
        const { value } = e.currentTarget;
        if (value === "system") return document.body.removeAttribute("data-theme");

        document.body.setAttribute("data-theme", value);
    }

    const template = document.querySelector("template");
    document.querySelectorAll("[data-template]").forEach(el => {
        console.log(el)
        el.replaceWith(template.content.cloneNode(true));
    });
}