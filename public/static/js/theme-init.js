// Runs before first paint (blocking, in <head>). Light is the default; dark only when the
// visitor chose it with the theme button.
(function () {
  var theme = "light";
  try {
    if (localStorage.getItem("theme") === "dark") theme = "dark";
  } catch (e) {}
  document.documentElement.setAttribute("data-theme", theme);
})();
