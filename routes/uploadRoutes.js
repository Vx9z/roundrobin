const express = require("express");
const router = express.Router();
const upload = require("../config/multer");

// Avatar upload
router.post("/upload/avatar/:id", upload.single("avatar"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  res.json({ filePath: "/uploads/" + req.file.filename });
});

// Banner upload
router.post("/upload/banner/:id", upload.single("banner"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  res.json({ filePath: "/uploads/" + req.file.filename });
});

// Post media upload
router.post("/upload/post/:id", upload.single("media"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  res.json({ filePath: "/uploads/" + req.file.filename });
});

module.exports = router;
