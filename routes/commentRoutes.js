const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");

router.post("/posts/:id/comments", commentController.createComment);
router.post("/posts/:id/comments/delete", commentController.deleteComment);

module.exports = router;
