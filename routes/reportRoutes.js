const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");

// Report actions live under the prefix of the entity being reported, the
// same way reactionRoutes owns /posts/:id/like and bookmarkRoutes owns
// /posts/:id/bookmark -- one router per controller, not per URL prefix.
router.post("/posts/:id/report", reportController.reportPost);
router.post("/profile/:id/report", reportController.reportUser);
router.post("/communities/:id/report", reportController.reportCommunity);

module.exports = router;
