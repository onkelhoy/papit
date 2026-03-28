import '@papit/router';

let loadindex = 0

window.onload = () => {
    document.querySelector("h1[data-testid='loads']").innerHTML = ++loadindex

    document.querySelectorAll("button").forEach(button => {
        button.onclick = () => {
            const router = document.querySelector("pap-router");
            router.url = button.getAttribute("data-url");
        }
    })
}