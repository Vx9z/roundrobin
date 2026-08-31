// Entrance animation for the auth-page wordmark. Purely decorative -- the page
// is fully usable with JS off, so the ONLY hard requirement is that the
// letters never stay invisible. They start at opacity-0 in the markup so the
// animation can fade them in; if anime.js failed to load, they are revealed
// synchronously below.
(function () {
  var letters = document.querySelectorAll("#wordmark .letter");
  if (!letters.length) return;

  var lib = window.anime;
  if (!lib || typeof lib.animate !== "function") {
    for (var i = 0; i < letters.length; i++) letters[i].style.opacity = 1; // degrade
    return;
  }

  // Respect the OS "reduce motion" setting: show, don't animate.
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    for (var j = 0; j < letters.length; j++) letters[j].style.opacity = 1;
    return;
  }

  // anime.js v4 exposes named exports on the UMD global; v4 renamed the
  // v3 `easing` option to `ease`, and property keyframes are [from, to].
  lib.animate("#wordmark .letter", {
    opacity: [0, 1],
    translateY: [24, 0],
    scale: [0.85, 1],
    delay: lib.stagger(45),
    duration: 700,
    ease: "outCubic"
  });

  lib.animate(".login-form", {
    opacity: [0, 1],
    translateY: [16, 0],
    duration: 600,
    delay: 500,
    ease: "outCubic"
  });
})();
