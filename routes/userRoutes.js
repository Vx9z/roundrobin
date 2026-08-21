const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// Search all users
router.get("/search", userController.searchUsers);

// View a specific profile
router.get("/profile/:id", userController.viewProfile);

// Follow / Unfollow / Block actions
router.post("/profile/:id/follow", userController.followUser);
router.post("/profile/:id/unfollow", userController.unfollowUser);
router.post("/profile/:id/block", userController.blockUser);

module.exports = router;
