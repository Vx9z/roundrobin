const express = require("express");
const router = express.Router();
const reactionController = require("../controllers/reactionController");

router.post("/posts/:id/like", reactionController.toggleLike);

module.exports = router;
