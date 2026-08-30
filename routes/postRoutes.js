const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const postController = require("../controllers/postController");

router.get("/feed", postController.showFeed);
router.get("/suggested", postController.showSuggested);
router.get("/hashtags/:tag", postController.showHashtag);
router.post("/posts", upload.single("media"), postController.createPost);
router.post("/posts/:id/delete", postController.deletePost);

module.exports = router;
