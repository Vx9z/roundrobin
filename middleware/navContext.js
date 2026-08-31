const { getCurrentUserID } = require("./auth");
const { isGeneralMod } = require("./permissions");
const Notification = require("../models/notification");
const UserProfile = require("../models/userProfile");
const { themeNameFor, DEFAULT_THEME } = require("../config/themes");

// Populates res.locals so the shared navbar partial and the shared layout can
// render on every page without every controller needing to pass this data
// explicitly. Never redirects -- must not hijack public pages.
async function attachNavContext(req, res, next) {
  const currentUserID = getCurrentUserID(req);
  res.locals.navUserID = currentUserID;
  res.locals.unreadCount = 0;
  res.locals.isGeneralMod = false;
  // Logged-out pages (/login, /register) render in the default theme.
  res.locals.navTheme = DEFAULT_THEME.name;

  try {
    if (currentUserID) {
      res.locals.unreadCount = await Notification.count({
        where: { recipientID: currentUserID, isRead: false }
      });
      res.locals.isGeneralMod = await isGeneralMod(currentUserID);

      // One extra indexed PK lookup per request. Cheap, and it is what lets
      // <html data-theme> be correct on every page including ones whose
      // controllers know nothing about theming.
      const profile = await UserProfile.findByPk(currentUserID, { attributes: ["themeID"] });
      res.locals.navTheme = themeNameFor(profile?.themeID);
    }
  } catch (err) {
    console.error("navContext failed:", err.message); // badge/theme are cosmetic, never fail the page
  }

  next();
}

module.exports = { attachNavContext };
