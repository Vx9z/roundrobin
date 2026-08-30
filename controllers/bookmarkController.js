const Bookmark = require("../models/bookmark");
const { getCurrentUserID } = require("../middleware/auth");
const { getBookmarkedPosts } = require("./postController");

exports.showBookmarks = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const posts = await getBookmarkedPosts(currentUserID);
    res.render("bookmarks", { title: "Bookmarks", currentUserID, returnTo: "/bookmarks", posts });
  } catch (err) {
    res.status(500).send("Error loading bookmarks: " + err.message);
  }
};

exports.toggleBookmark = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const existing = await Bookmark.findOne({ where: { postID: req.params.id, userID: currentUserID } });
    if (existing) {
      await existing.destroy();
    } else {
      await Bookmark.create({ postID: req.params.id, userID: currentUserID });
    }
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error toggling bookmark: " + err.message);
  }
};
