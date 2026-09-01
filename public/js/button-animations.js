// Subtle hover/click feedback on daisyUI buttons, via anime.js. Purely
// decorative -- every button already works without this; if anime.js
// failed to load, or the user asked for reduced motion, this just never
// attaches and nothing breaks.
(function () {
  var lib = window.anime;
  if (!lib || typeof lib.animate !== "function") return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  // mouseenter/mouseleave don't bubble -- delegation needs the capture phase.
  document.addEventListener("mouseenter", function (e) {
    var btn = e.target.closest(".d-btn");
    if (btn) lib.animate(btn, { scale: 1.06, duration: 150, ease: "outQuad" });
  }, true);

  document.addEventListener("mouseleave", function (e) {
    var btn = e.target.closest(".d-btn");
    if (btn) lib.animate(btn, { scale: 1, duration: 150, ease: "outQuad" });
  }, true);

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".d-btn");
    if (btn) lib.animate(btn, { scale: [1, 0.9, 1], duration: 220, ease: "outQuad" });
  });
})();
