window.onload = () => {
  const parama = document.getElementById("param-a");
  const paramb = document.getElementById("param-b");
  const paramc = document.getElementById("param-c");

  if (parama) {
    parama.innerHTML = window.location.params.a;
  }

  if (paramb) {
    paramb.innerHTML = window.location.params.b;
  }

  if (paramc) {
    paramc.innerHTML = window.location.params.c;
  }
}