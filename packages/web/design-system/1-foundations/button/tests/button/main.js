import '@papit/button';

window.onload = () => {
    document.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        window.SUBMITTED = (window.SUBMITTED ?? 0) + 1;
    }
}
