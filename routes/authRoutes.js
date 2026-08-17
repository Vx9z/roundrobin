const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Registration and login endpoints
router.post("/login", authController.login);
router.post("/register", authController.register);

module.exports = router;
