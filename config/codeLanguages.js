// Curated whitelist for the post-compose "code" panel's language dropdown.
// id = the name postController registers with hljs (see highlightCode) --
// "plaintext" is handled specially there: no grammar, just HTML-escaped.
// IDs are permanent -- never renumber/reuse, only ever append -- since
// existing posts store the id in codelanguage forever.
const CODE_LANGUAGES = [
  { id: "plaintext", label: "Plain text" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "sql", label: "SQL" },
  { id: "bash", label: "Bash" },
  { id: "json", label: "JSON" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" }
];

function isValidLanguage(id) {
  return CODE_LANGUAGES.some(l => l.id === id);
}

module.exports = { CODE_LANGUAGES, isValidLanguage };
