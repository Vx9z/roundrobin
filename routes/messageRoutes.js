const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");

router.get("/messages", messageController.showInbox);
router.get("/messages/new", messageController.showNewDMForm);           // must precede /messages/:id
router.get("/messages/groups/new", messageController.showNewGroupForm); // must precede /messages/:id
router.get("/ai-chat", messageController.showAIChat);
router.post("/messages/dm", messageController.startDM);
router.post("/messages/groups", messageController.createGroup);
router.get("/messages/:id", messageController.showThread);
router.post("/messages/:id/send", messageController.sendMessage);
router.post("/messages/:id/leave", messageController.leaveGroup);

module.exports = router;
