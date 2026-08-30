const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

router.get("/notifications", notificationController.showNotifications);
router.post("/notifications/read-all", notificationController.markAllRead);
router.post("/notifications/:id/read", notificationController.markRead);

module.exports = router;
