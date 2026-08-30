const { getCurrentUserID } = require("./auth");
const { isGeneralMod } = require("./permissions");
const Notification = require("../models/notification");

// Populates res.locals so the shared navbar partial can render on every page
// without every controller needing to pass this data explicitly. Never
// redirects -- must not hijack public pages.
async function attachNavContext(req, res, next) {
  const currentUserID = getCurrentUserID(req);
  res.locals.navUserID = currentUserID;
  res.locals.unreadCount = 0;
  res.locals.isGeneralMod = false;

  try {
    if (currentUserID) {
      res.locals.unreadCount = await Notification.count({
        where: { recipientID: currentUserID, isRead: false }
      });
      res.locals.isGeneralMod = await isGeneralMod(currentUserID);
    }
  } catch (err) {
    console.error("navContext failed:", err.message); // badge is cosmetic, never fail the page
  }

  next();
}

module.exports = { attachNavContext };
