// Deliberately DB-free: this file must never require anything under models/
// or config/database.js. postController.js is its only consumer today, but
// this invariant matters beyond that -- any future DB-free script (like
// bots/codeBot, which posts real code via this same highlighting/language
// path but talks to the server over HTTP instead of importing
// postController.js directly) depends on requiring this file never opening
// a real Sequelize/Postgres connection as a module-load side effect.
const hljs = require("highlight.js/lib/core");
const { isValidLanguage } = require("../config/codeLanguages");

// Only the languages actually offered in the compose dropdown get registered --
// avoids pulling in all ~190 grammars the full "highlight.js" package ships.
hljs.registerLanguage("javascript", require("highlight.js/lib/languages/javascript"));
hljs.registerLanguage("typescript", require("highlight.js/lib/languages/typescript"));
hljs.registerLanguage("python", require("highlight.js/lib/languages/python"));
hljs.registerLanguage("java", require("highlight.js/lib/languages/java"));
hljs.registerLanguage("c", require("highlight.js/lib/languages/c"));
hljs.registerLanguage("cpp", require("highlight.js/lib/languages/cpp"));
hljs.registerLanguage("csharp", require("highlight.js/lib/languages/csharp"));
hljs.registerLanguage("go", require("highlight.js/lib/languages/go"));
hljs.registerLanguage("sql", require("highlight.js/lib/languages/sql"));
hljs.registerLanguage("bash", require("highlight.js/lib/languages/bash"));
hljs.registerLanguage("json", require("highlight.js/lib/languages/json"));
hljs.registerLanguage("html", require("highlight.js/lib/languages/xml")); // xml.js covers html
hljs.registerLanguage("css", require("highlight.js/lib/languages/css"));

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Re-validates at READ time, not just write time (config/codeLanguages.js's
// list could theoretically change after a post was written). ignoreIllegals
// because we're force-highlighting arbitrary text against a possibly-
// mismatched language choice -- hljs throws by default on grammar mismatches,
// which would otherwise take down an entire list page since hydratePost runs
// inside Promise.all for every post in it. try/catch is defense in depth
// beyond that: a bad snippet must never break the page, worst case it just
// renders unhighlighted.
function highlightCode(code, language) {
  if (!code) return null;
  const lang = isValidLanguage(language) ? language : "plaintext";
  if (lang === "plaintext") return escapeHtml(code);
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch (err) {
    return escapeHtml(code);
  }
}

module.exports = { highlightCode };
