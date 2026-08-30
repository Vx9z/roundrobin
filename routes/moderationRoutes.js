const express = require("express");
const router = express.Router();
const moderationController = require("../controllers/moderationController");

// Community-scoped moderation (a general mod passes isCommunityMod by override)
router.get("/communities/:id/dashboard", moderationController.showCommunityDashboard);
router.post("/communities/:id/members/:userID/kick", moderationController.kickMember);
router.post("/communities/:id/members/:userID/ban", moderationController.banMember);
router.post("/communities/:id/members/:userID/unban", moderationController.unbanMember);
router.post("/communities/:id/members/:userID/promote", moderationController.promoteMember);
router.post("/communities/:id/members/:userID/demote", moderationController.demoteMember);
router.post("/communities/:id/posts/:postID/delete", moderationController.modDeletePost);
router.post("/communities/:id/delete", moderationController.deleteCommunity);

// Report triage. dismissPostReports is ONE route for both dashboards; it
// picks isCommunityMod vs isGeneralMod from the post's own communityID.
router.post("/posts/:id/report/dismiss", moderationController.dismissPostReports);

// Platform-scoped moderation
router.get("/admin/dashboard", moderationController.showAdminDashboard);
router.get("/admin/users/:id", moderationController.showUserAnalytics);
router.post("/admin/users/:userID/suspend", moderationController.suspendUser);
router.post("/admin/users/:userID/unsuspend", moderationController.unsuspendUser);
router.post("/admin/reports/users/:userID/dismiss", moderationController.dismissUserReports);
router.post("/admin/reports/communities/:communityID/dismiss", moderationController.dismissCommunityReports);
router.post("/admin/posts/:postID/delete", moderationController.adminDeletePost);

module.exports = router;
