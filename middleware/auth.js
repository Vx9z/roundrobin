const jwt = require("jsonwebtoken");

function getCurrentUserID(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, "SECRET_KEY").id;
  } catch {
    return null;
  }
}

// Same guard every post-action controller needs, but XHR-aware: a fetch()
// call gets a real 401 JSON response instead of a redirect. This matters
// because fetch() follows redirects by default -- a plain res.redirect here
// would make an expired-session fetch silently "succeed" with the login
// page's HTML as its body, which then fails to parse as JSON with no
// feedback to the user. See public/js/post-actions.js.
function requireAuthOrXhr(req, res) {
  const currentUserID = getCurrentUserID(req);
  if (!currentUserID) {
    if (req.xhr) res.status(401).json({ error: "Not authenticated" });
    else res.redirect("/login");
    return null;
  }
  return currentUserID;
}

module.exports = { getCurrentUserID, requireAuthOrXhr };
