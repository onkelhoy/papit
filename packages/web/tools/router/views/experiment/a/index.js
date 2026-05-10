window.onload = () => {
  console.log('document A loaded');
  console.log(document)

  document.querySelector('button#btn').onclick = () => {
    console.log('document A click');
  }

  const ps = document.querySelectorAll("body>p"); // TODO body reference still needs to be cleanup
  ps.forEach(p => {
    p.textContent = p.textContent + " updated"
  });

}