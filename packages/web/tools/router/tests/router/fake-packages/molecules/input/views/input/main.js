window.onload = () => {
  const p = document.querySelector('p');
  p.innerHTML = window.location.params.view;
}