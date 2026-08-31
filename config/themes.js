// userProfile.themeID is an INTEGER, unused since the original schema.
// IDs are permanent -- never renumber, never reuse a retired id (existing
// rows hold the old number forever). Only ever append.
const THEMES = [
  { id: 0, name: "light", label: "Default (Light)" },
  { id: 1, name: "dark", label: "Dark" },
  { id: 2, name: "vscode-dark", label: "VSCode Dark+" },
  { id: 3, name: "anime-pastel", label: "Anime Pastel" }
];

const DEFAULT_THEME = THEMES[0];

// Never throws, never renders data-theme="undefined" and losing every color.
function themeNameFor(themeID) {
  const match = THEMES.find(t => t.id === Number(themeID));
  return (match || DEFAULT_THEME).name;
}

// Guards the form POST -- an id we don't know must never reach the column.
function isValidThemeID(themeID) {
  return THEMES.some(t => t.id === Number(themeID));
}

module.exports = { THEMES, DEFAULT_THEME, themeNameFor, isValidThemeID };
