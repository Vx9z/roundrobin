(function () {
  if (!navigator.clipboard) {
    document.querySelectorAll(".copy-code-btn").forEach(function (b) { b.style.display = "none"; });
    return;
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-code-btn");
    if (!btn) return;
    var block = btn.closest(".code-block-wrapper");
    var code = block && block.querySelector("code");
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function () {
      var original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = original; }, 1500);
    });
  });
})();
