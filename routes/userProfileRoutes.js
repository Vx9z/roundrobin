const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const userProfileController = require("../controllers/userProfileController");

router.get("/profile/:id/edit", userProfileController.editProfile);
router.post(
  "/profile/:id/edit",
  upload.fields([{ name: "avatar" }, { name: "banner" }]),
  userProfileController.updateProfile
);

module.exports = router;
