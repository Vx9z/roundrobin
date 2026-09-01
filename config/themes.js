// userProfile.themeID is an INTEGER, unused since the original schema.
// IDs are permanent -- never renumber, never reuse a retired id (existing
// rows hold the old number forever). Only ever append.
const THEMES = [
  { id: 0, name: "light", label: "Light" },
  { id: 1, name: "dark", label: "Dark" },
  { id: 2, name: "vscode-dark", label: "VSCode Dark+ (Default)" },
  { id: 3, name: "anime-pastel", label: "Anime Pastel" }
];

// Site default: this is a coder-focused platform, so the VS Code-styled dark
// theme (green accent) is what a fresh/never-configured account sees, not
// stock light. Matches userprofile.themeid's own column default -- see
// db/set-default-theme.sql. IDs still never get renumbered/reused; this only
// changes which existing id is treated as the fallback.
const DEFAULT_THEME = THEMES[2];

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
