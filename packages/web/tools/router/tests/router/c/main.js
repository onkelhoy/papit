window.onload = () => {
    const ps = document.querySelectorAll("body > p");
    ps.forEach(p => {
        p.textContent = p.textContent + " updated"
    });

    const router = document.querySelector("pap-router");
    if (router)
    {
        const param = document.querySelector("#param");
        if (router.params.foo)
        {
            param.innerHTML = router.params.foo;
        }
    }
}