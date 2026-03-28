window.onload = () => {
  console.log('document C loaded');
  document.querySelector('button#btn').onclick = () => {
    console.log('document C click');
  }

  const foo = document.getElementById("foo");
  if (foo) {
    foo.innerText = window.location.params?.foo;
  }
}