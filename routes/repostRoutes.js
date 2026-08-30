const express = require("express");
const router = express.Router();
const repostController = require("../controllers/repostController");

router.post("/posts/:id/repost", repostController.toggleRepost);

module.exports = router;
