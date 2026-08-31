(function () {
  document.querySelectorAll("[data-code-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var panel = document.querySelector(btn.getAttribute("data-code-toggle"));
      if (panel) panel.classList.toggle("hidden");
    });
  });
})();
