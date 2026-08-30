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

module.exports = { getCurrentUserID };
