const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const communityController = require("../controllers/communityController");

router.get("/communities", communityController.listCommunities);
router.get("/communities/new", communityController.showCreateForm); // must precede /communities/:id
router.post("/communities", upload.single("banner"), communityController.createCommunity);
router.get("/communities/:id", communityController.showCommunity);
router.post("/communities/:id/join", communityController.joinCommunity);
router.post("/communities/:id/leave", communityController.leaveCommunity);

module.exports = router;
