const multer = require("multer");
const path = require("path");

// Centralized storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Later we can branch by type (avatars, posts, banners)
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + file.originalname); // unique filename
  }
});

// Reusable upload middleware
const upload = multer({ storage });

module.exports = upload;
