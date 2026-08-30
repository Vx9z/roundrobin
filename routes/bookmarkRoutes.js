const express = require("express");
const router = express.Router();
const bookmarkController = require("../controllers/bookmarkController");

router.get("/bookmarks", bookmarkController.showBookmarks);
router.post("/posts/:id/bookmark", bookmarkController.toggleBookmark);

module.exports = router;
