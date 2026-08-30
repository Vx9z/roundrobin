const User = require("../models/user");
const UserProfile = require("../models/userProfile");
const Community = require("../models/community");
const CommunityMember = require("../models/communityMember");
const Post = require("../models/post");
const { getCurrentUserID } = require("../middleware/auth");
const { isGeneralMod, isCommunityMod } = require("../middleware/permissions");
const { createNotification } = require("./notificationController");
const { hydratePost } = require("./postController");

// A community moderator may not act on another community moderator of the
// SAME community -- only a general mod can. Also refuses self-targeting
// (use Leave/the community board instead). Returns the target's membership
// row on success, or null (and has already redirected) on failure.
async function peerGuard(req, res, communityID, targetID, currentUserID) {
  if (targetID === currentUserID) {
    res.redirect(`/communities/${communityID}/dashboard`);
    return null;
  }
  const targetRow = await CommunityMember.findOne({ where: { communityID, userID: targetID } });
  if (!targetRow) {
    res.redirect(`/communities/${communityID}/dashboard`);
    return null;
  }
  if (targetRow.role === "moderator" && !(await isGeneralMod(currentUserID))) {
    res.redirect(`/communities/${communityID}/dashboard`);
    return null;
  }
  return targetRow;
}

exports.showCommunityDashboard = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const communityID = req.params.id;
    if (!(await isCommunityMod(currentUserID, communityID))) {
      return res.redirect(`/communities/${communityID}`);
    }

    const community = await Community.findByPk(communityID);
    if (!community) return res.redirect("/communities");

    const viewerIsGeneralMod = await isGeneralMod(currentUserID);

    const memberRows = await CommunityMember.findAll({
      where: { communityID },
      include: [{ model: User }]
    });
    const members = memberRows.map(m => ({
      userID: m.userID,
      username: m.User ? m.User.username : "[deleted]",
      role: m.role,
      status: m.status,
      isModerator: m.role === "moderator",
      isBanned: m.status === "banned",
      canModerate: m.userID !== currentUserID && (m.role !== "moderator" || viewerIsGeneralMod)
    }));

    const rawPosts = await Post.findAll({ where: { communityID }, order: [["createdAt", "DESC"]] });
    const posts = await Promise.all(rawPosts.map(p => hydratePost(p, currentUserID)));

    res.render("community/dashboard", {
      title: `Moderating: ${community.name}`,
      currentUserID,
      communityID,
      name: community.name,
      memberCount: members.length,
      members,
      posts,
      returnTo: `/communities/${communityID}/dashboard`,
      viewerIsGeneralMod
    });
  } catch (err) {
    res.status(500).send("Error loading dashboard: " + err.message);
  }
};

exports.kickMember = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { id: communityID, userID: targetID } = req.params;
    if (!(await isCommunityMod(currentUserID, communityID))) return res.redirect(`/communities/${communityID}`);

    const targetRow = await peerGuard(req, res, communityID, targetID, currentUserID);
    if (!targetRow) return;

    await CommunityMember.destroy({ where: { communityID, userID: targetID } });
    await createNotification({
      recipientID: targetID, actorID: currentUserID,
      type: "community_removed", entityType: "community", entityID: communityID
    });
    res.redirect(`/communities/${communityID}/dashboard`);
  } catch (err) {
    res.status(500).send("Error kicking member: " + err.message);
  }
};

exports.banMember = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { id: communityID, userID: targetID } = req.params;
    if (!(await isCommunityMod(currentUserID, communityID))) return res.redirect(`/communities/${communityID}`);

    const targetRow = await peerGuard(req, res, communityID, targetID, currentUserID);
    if (!targetRow) return;

    // Force-demote on ban: a banned row must never still pass the moderator check.
    await CommunityMember.update(
      { status: "banned", role: "member" },
      { where: { communityID, userID: targetID } }
    );
    await createNotification({
      recipientID: targetID, actorID: currentUserID,
      type: "community_banned", entityType: "community", entityID: communityID
    });
    res.redirect(`/communities/${communityID}/dashboard`);
  } catch (err) {
    res.status(500).send("Error banning member: " + err.message);
  }
};

exports.unbanMember = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { id: communityID, userID: targetID } = req.params;
    if (!(await isCommunityMod(currentUserID, communityID))) return res.redirect(`/communities/${communityID}`);

    // Deleting the banned row returns them to "not a member, free to rejoin".
    await CommunityMember.destroy({ where: { communityID, userID: targetID, status: "banned" } });
    res.redirect(`/communities/${communityID}/dashboard`);
  } catch (err) {
    res.status(500).send("Error unbanning member: " + err.message);
  }
};

exports.promoteMember = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { id: communityID, userID: targetID } = req.params;
    if (!(await isCommunityMod(currentUserID, communityID))) return res.redirect(`/communities/${communityID}`);

    await CommunityMember.update(
      { role: "moderator" },
      { where: { communityID, userID: targetID, status: "active" } }
    );
    await createNotification({
      recipientID: targetID, actorID: currentUserID,
      type: "community_promoted", entityType: "community", entityID: communityID
    });
    res.redirect(`/communities/${communityID}/dashboard`);
  } catch (err) {
    res.status(500).send("Error promoting member: " + err.message);
  }
};

exports.demoteMember = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { id: communityID, userID: targetID } = req.params;
    if (!(await isCommunityMod(currentUserID, communityID))) return res.redirect(`/communities/${communityID}`);

    const targetRow = await peerGuard(req, res, communityID, targetID, currentUserID);
    if (!targetRow) return;

    await CommunityMember.update(
      { role: "member" },
      { where: { communityID, userID: targetID, status: "active" } }
    );
    await createNotification({
      recipientID: targetID, actorID: currentUserID,
      type: "community_demoted", entityType: "community", entityID: communityID
    });
    res.redirect(`/communities/${communityID}/dashboard`);
  } catch (err) {
    res.status(500).send("Error demoting member: " + err.message);
  }
};

exports.modDeletePost = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { id: communityID, postID } = req.params;
    if (!(await isCommunityMod(currentUserID, communityID))) return res.redirect(`/communities/${communityID}`);

    const post = await Post.findOne({ where: { postID, communityID } });
    if (post) {
      const authorID = post.authorID;
      // communityID in the WHERE stops a mod of community A from deleting a
      // post that actually belongs to community B.
      await Post.destroy({ where: { postID, communityID } });
      await createNotification({
        recipientID: authorID, actorID: currentUserID,
        type: "post_removed", entityType: "post", entityID: postID
      });
    }
    res.redirect(`/communities/${communityID}/dashboard`);
  } catch (err) {
    res.status(500).send("Error removing post: " + err.message);
  }
};

exports.deleteCommunity = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const communityID = req.params.id;
    if (!(await isCommunityMod(currentUserID, communityID))) return res.redirect(`/communities/${communityID}`);

    const community = await Community.findByPk(communityID);
    if (!community) return res.redirect("/communities");

    // Destructive: this cascades away every post (and their comments/
    // reactions/bookmarks/reposts) in the community. No client-side JS is
    // available for a confirm() dialog, so require the name to be typed.
    if (req.body.confirmName !== community.name) {
      return res.redirect(`/communities/${communityID}/dashboard`);
    }

    // Capture the member list BEFORE destroying -- the delete cascades
    // communityMembers away too.
    const memberRows = await CommunityMember.findAll({ where: { communityID } });

    await Community.destroy({ where: { communityID } });

    for (const member of memberRows) {
      await createNotification({
        recipientID: member.userID, actorID: currentUserID,
        type: "community_deleted", entityType: "community", entityID: communityID
      });
    }

    res.redirect("/communities");
  } catch (err) {
    res.status(500).send("Error deleting community: " + err.message);
  }
};

exports.showAdminDashboard = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");
    if (!(await isGeneralMod(currentUserID))) return res.redirect("/feed");

    const rawUsers = await User.findAll({
      include: [{ model: UserProfile, as: "Profile" }],
      order: [["username", "ASC"]]
    });
    const users = rawUsers.map(u => ({
      userID: u.userID,
      username: u.username,
      clearanceLevel: u.clearanceLevel,
      isSuspended: !!(u.Profile && u.Profile.isDeleted),
      isSelf: u.userID === currentUserID
    }));

    const rawCommunities = await Community.findAll({ order: [["name", "ASC"]] });
    const communities = await Promise.all(rawCommunities.map(async c => ({
      communityID: c.communityID,
      name: c.name,
      memberCount: await CommunityMember.count({ where: { communityID: c.communityID, status: "active" } })
    })));

    res.render("admin/dashboard", { title: "Platform Moderation", currentUserID, users, communities });
  } catch (err) {
    res.status(500).send("Error loading admin dashboard: " + err.message);
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");
    if (!(await isGeneralMod(currentUserID))) return res.redirect("/feed");

    const targetID = req.params.userID;
    if (targetID === currentUserID) return res.redirect("/admin/dashboard"); // no self-lockout

    // Most users have no userprofile row yet -- a bare update would silently
    // affect zero rows for them.
    const [profile] = await UserProfile.findOrCreate({ where: { userID: targetID } });
    await profile.update({ isDeleted: true, deletedAt: new Date() });

    await createNotification({
      recipientID: targetID, actorID: null,
      type: "account_suspended"
    });
    res.redirect("/admin/dashboard");
  } catch (err) {
    res.status(500).send("Error suspending user: " + err.message);
  }
};

exports.unsuspendUser = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");
    if (!(await isGeneralMod(currentUserID))) return res.redirect("/feed");

    await UserProfile.update(
      { isDeleted: false, deletedAt: null },
      { where: { userID: req.params.userID } }
    );
    res.redirect("/admin/dashboard");
  } catch (err) {
    res.status(500).send("Error unsuspending user: " + err.message);
  }
};
