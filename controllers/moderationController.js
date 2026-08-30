const { Op } = require("sequelize");
const User = require("../models/user");
const UserProfile = require("../models/userProfile");
const Community = require("../models/community");
const CommunityMember = require("../models/communityMember");
const Post = require("../models/post");
const Comment = require("../models/comment");
const Reaction = require("../models/reaction");
const Bookmark = require("../models/bookmark");
const Repost = require("../models/repost");
const UserRelationship = require("../models/userRelationships");
const Report = require("../models/report");
const { getCurrentUserID } = require("../middleware/auth");
const { isGeneralMod, isCommunityMod } = require("../middleware/permissions");
const { createNotification } = require("./notificationController");
const { hydratePost } = require("./postController");
const { getFriends } = require("./userController");

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

// Aggregate pending reports into a ranked "needs attention" list, tallied
// in plain JS and sorted as an array -- the same approach getSuggestedPosts
// takes, not a SQL GROUP BY. Most-reported first, oldest-unresolved-complaint
// first on a tie.
async function rankPendingReports(entityType) {
  const pending = await Report.findAll({
    where: { entityType, status: "pending" },
    order: [["createdAt", "ASC"]]
  });

  const counts = {};
  const firstSeen = {};
  for (const r of pending) {
    counts[r.entityID] = (counts[r.entityID] || 0) + 1;
    if (!firstSeen[r.entityID]) firstSeen[r.entityID] = r.createdAt;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || firstSeen[a[0]] - firstSeen[b[0]])
    .map(([entityID, reportCount]) => ({
      entityID,
      reportCount,
      firstReportedAtDisplay: firstSeen[entityID].toLocaleString()
    }));
}

// Turn ranked post IDs into flat display rows. Deliberately NOT hydratePost:
// a moderator triaging a report should not be handed Like/Repost/Comment
// forms for the content they are judging, and hydratePost costs ~7 queries
// per post. communityFilterID scopes the community dashboard to its own
// posts; the admin dashboard passes null and sees every reported post
// platform-wide, because a general mod's authority is a superset.
async function buildReportedPosts(rankedRows, communityFilterID) {
  const rows = [];
  for (const r of rankedRows) {
    const post = await Post.findByPk(r.entityID);
    // entityID has no FK, so a deleted post leaves orphan reports behind.
    // They stay in the table as history and are simply skipped at render.
    if (!post) continue;
    if (communityFilterID && post.communityID !== communityFilterID) continue;

    const author = await User.findByPk(post.authorID);
    const community = post.communityID ? await Community.findByPk(post.communityID) : null;
    const body = post.content || "";

    rows.push({
      postID: post.postID,
      authorID: post.authorID,
      authorUsername: author ? author.username : "[deleted]",
      preview: body ? (body.length > 140 ? body.slice(0, 140) + "…" : body) : "(media only)",
      hasMedia: !!post.mediaURL,
      communityID: post.communityID,
      communityName: community ? community.name : null,
      inCommunity: !!community,
      createdAtDisplay: post.createdAt.toLocaleString(),
      reportCount: r.reportCount,
      firstReportedAtDisplay: r.firstReportedAtDisplay
    });
  }
  return rows;
}

async function buildReportedUsers(rankedRows) {
  const rows = [];
  for (const r of rankedRows) {
    const user = await User.findByPk(r.entityID);
    if (!user) continue;
    const profile = await UserProfile.findByPk(user.userID);
    rows.push({
      userID: user.userID,
      username: user.username,
      isSuspended: !!(profile && profile.isDeleted),
      reportCount: r.reportCount,
      firstReportedAtDisplay: r.firstReportedAtDisplay
    });
  }
  return rows;
}

async function buildReportedCommunities(rankedRows) {
  const rows = [];
  for (const r of rankedRows) {
    const community = await Community.findByPk(r.entityID);
    if (!community) continue;
    rows.push({
      communityID: community.communityID,
      name: community.name,
      memberCount: await CommunityMember.count({ where: { communityID: community.communityID, status: "active" } }),
      reportCount: r.reportCount,
      firstReportedAtDisplay: r.firstReportedAtDisplay
    });
  }
  return rows;
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

    // Reported posts belonging to THIS community. Same isCommunityMod gate
    // that already guards this page -- a general mod sees it through the
    // existing override, no second permission path.
    const reportedPosts = await buildReportedPosts(await rankPendingReports("post"), communityID);

    res.render("community/dashboard", {
      title: `Moderating: ${community.name}`,
      currentUserID,
      communityID,
      name: community.name,
      memberCount: members.length,
      members,
      posts,
      reportedPosts,
      reportedPostCount: reportedPosts.length,
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

    // Every reported post platform-wide, community and non-community alike --
    // a general mod's authority is a superset.
    const reportedPosts = await buildReportedPosts(await rankPendingReports("post"), null);
    const reportedUsers = await buildReportedUsers(await rankPendingReports("user"));
    const reportedCommunities = await buildReportedCommunities(await rankPendingReports("community"));

    res.render("admin/dashboard", {
      title: "Platform Moderation", currentUserID, users, communities,
      reportedPosts, reportedUsers, reportedCommunities
    });
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

// ONE route for both dashboards. The gate is a property of the POST, not of
// the page the button was on: a post that lives in a community is that
// community's business (and isCommunityMod already ORs in the general-mod
// override, so the admin dashboard's button needs no separate branch), while
// a post with no community has no community mod to delegate to and is a
// platform-level matter only.
exports.dismissPostReports = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const postID = req.params.id;
    const returnTo = req.body.returnTo || "/admin/dashboard";

    const post = await Post.findByPk(postID);
    if (!post) return res.redirect(returnTo);

    const allowed = post.communityID
      ? await isCommunityMod(currentUserID, post.communityID)
      : await isGeneralMod(currentUserID);
    if (!allowed) return res.redirect("/feed");

    // Dismiss every pending report for this post at once: the dashboard
    // shows an aggregate count, so the action must operate on the same unit.
    // Rows are updated, never deleted -- they stay as history.
    await Report.update(
      { status: "dismissed" },
      { where: { entityType: "post", entityID: postID, status: "pending" } }
    );
    res.redirect(returnTo);
  } catch (err) {
    res.status(500).send("Error dismissing post reports: " + err.message);
  }
};

exports.dismissUserReports = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");
    if (!(await isGeneralMod(currentUserID))) return res.redirect("/feed");

    await Report.update(
      { status: "dismissed" },
      { where: { entityType: "user", entityID: req.params.userID, status: "pending" } }
    );
    res.redirect("/admin/dashboard");
  } catch (err) {
    res.status(500).send("Error dismissing user reports: " + err.message);
  }
};

exports.dismissCommunityReports = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");
    if (!(await isGeneralMod(currentUserID))) return res.redirect("/feed");

    await Report.update(
      { status: "dismissed" },
      { where: { entityType: "community", entityID: req.params.communityID, status: "pending" } }
    );
    res.redirect("/admin/dashboard");
  } catch (err) {
    res.status(500).send("Error dismissing community reports: " + err.message);
  }
};

// Closes a real gap: deletePost only allows an author to delete their own
// post, and modDeletePost only works for posts inside a community. A
// reported personal (non-community) post otherwise has no removal path.
exports.adminDeletePost = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");
    if (!(await isGeneralMod(currentUserID))) return res.redirect("/feed");

    const post = await Post.findByPk(req.params.postID);
    if (post) {
      const authorID = post.authorID;
      await Post.destroy({ where: { postID: post.postID } });
      await createNotification({
        recipientID: authorID, actorID: currentUserID,
        type: "post_removed", entityType: "post", entityID: req.params.postID
      });
    }
    res.redirect("/admin/dashboard");
  } catch (err) {
    res.status(500).send("Error removing post: " + err.message);
  }
};

// ---- post-frequency chart -------------------------------------------------
// Every pixel below is computed here. The template only interpolates
// attributes; it performs no arithmetic and makes no comparisons, matching
// the rule that all display decisions are precomputed server-side.
const CHART_DAYS = 30;
const CHART_HEIGHT = 100; // px of drawable bar area
const BAR_WIDTH = 14;
const BAR_GAP = 4;
const CHART_TOP = 10;     // headroom above the tallest bar
const AXIS_HEIGHT = 22;   // reserved under the baseline for date labels

// Local-time YYYY-MM-DD. Uses the same local clock everything else displays
// with (toLocaleString), so a post shown as "8/30" buckets into 8/30 rather
// than into a UTC day that may differ by one.
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function buildPostFrequencyChart(userID) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (CHART_DAYS - 1)); // inclusive 30-day window

  const posts = await Post.findAll({
    where: { authorID: userID, createdAt: { [Op.gte]: start } },
    attributes: ["postID", "createdAt"]
  });

  // Tally in a plain object, same style as the hashtag and report tallies.
  const counts = {}; // 'YYYY-MM-DD' -> post count
  for (const p of posts) {
    const key = dayKey(p.createdAt);
    counts[key] = (counts[key] || 0) + 1;
  }

  // Materialise ALL 30 days in order, zero-filled: a graph with missing
  // days is worse than a graph with visible zeros.
  const days = [];
  for (let i = 0; i < CHART_DAYS; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKey(d);
    days.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, count: counts[key] || 0 });
  }

  // Scale against this user's own busiest day so the chart is readable
  // whether their peak is 2 posts or 50.
  const maxCount = days.reduce((m, d) => (d.count > m ? d.count : m), 0);
  const labelY = CHART_TOP + CHART_HEIGHT + 14;

  const bars = days.map((d, i) => {
    const scaled = maxCount === 0 ? 0 : Math.round((d.count / maxCount) * CHART_HEIGHT);
    // A day with posts always gets >= 2px so a 1-post day beside a 50-post
    // day is still visible; a zero day gets a 2px grey stub so the slot
    // reads as an empty day rather than a rendering gap.
    const height = d.count === 0 ? 2 : Math.max(2, scaled);
    return {
      key: d.key,
      label: d.label,
      count: d.count,
      x: i * (BAR_WIDTH + BAR_GAP),
      // SVG y grows downward: a bar's top edge is the baseline minus height.
      y: CHART_TOP + (CHART_HEIGHT - height),
      width: BAR_WIDTH,
      height,
      labelX: i * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2,
      labelY,                                  // per-bar so the template needs no ../ lookup
      showLabel: i % 5 === 0,                  // 30 date labels would collide
      isEmpty: d.count === 0,
      tooltip: `${d.label}: ${d.count} post${d.count === 1 ? "" : "s"}`
    };
  });

  return {
    bars,
    days: CHART_DAYS,
    maxCount,
    hasPosts: maxCount > 0,
    width: CHART_DAYS * (BAR_WIDTH + BAR_GAP) - BAR_GAP, // 30*18 - 4 = 536
    height: CHART_TOP + CHART_HEIGHT + AXIS_HEIGHT,      // 132
    baselineY: CHART_TOP + CHART_HEIGHT,                 // 110
    totalInWindow: days.reduce((s, d) => s + d.count, 0),
    startLabel: days[0].label,
    endLabel: days[days.length - 1].label
  };
}

exports.showUserAnalytics = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");
    if (!(await isGeneralMod(currentUserID))) return res.redirect("/feed");

    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect("/admin/dashboard");
    const targetID = user.userID;

    const profile = await UserProfile.findByPk(targetID);

    const followerCount = await UserRelationship.count({ where: { followingID: targetID, type: "follow" } });
    const followingCount = await UserRelationship.count({ where: { followerID: targetID, type: "follow" } });
    const blockedCount = await UserRelationship.count({ where: { followerID: targetID, type: "block" } });

    // Reuse, do not reimplement: getFriends is exported specifically for this.
    const friends = await getFriends(targetID);

    const postCount = await Post.count({ where: { authorID: targetID } });
    const commentCount = await Comment.count({ where: { authorID: targetID } });
    const likeGivenCount = await Reaction.count({ where: { userID: targetID, type: "like" } });
    const bookmarkCount = await Bookmark.count({ where: { userID: targetID } });
    const repostCount = await Repost.count({ where: { userID: targetID } });

    const membershipRows = await CommunityMember.findAll({
      where: { userID: targetID },
      include: [{ model: Community }]
    });
    const memberships = membershipRows.map(m => ({
      communityID: m.communityID,
      name: m.Community ? m.Community.name : "[deleted]",
      role: m.role,
      status: m.status,
      isModerator: m.role === "moderator",
      isBanned: m.status === "banned"
    }));

    // Reports filed AGAINST this account.
    const reportsAgainst = await Report.findAll({
      where: { entityType: "user", entityID: targetID },
      order: [["createdAt", "DESC"]]
    });
    const pendingReportCount = reportsAgainst.filter(r => r.status === "pending").length;
    const dismissedReportCount = reportsAgainst.filter(r => r.status === "dismissed").length;

    // Reports filed against POSTS this account authored. "How much trouble
    // does this account's content cause" is the question a general mod is
    // actually asking, and user-reports alone cannot answer it.
    const authored = await Post.findAll({ where: { authorID: targetID }, attributes: ["postID"] });
    const authoredIDs = authored.map(p => p.postID);
    const pendingPostReportCount = authoredIDs.length
      ? await Report.count({ where: { entityType: "post", entityID: authoredIDs, status: "pending" } })
      : 0;

    const chart = await buildPostFrequencyChart(targetID);

    res.render("admin/userAnalytics", {
      title: `Analytics: ${user.username}`,
      currentUserID,
      userID: targetID,
      username: user.username,
      email: user.email || "(none)",
      clearanceLevel: user.clearanceLevel,
      isTargetGeneralMod: user.clearanceLevel >= 1,
      isSuspended: !!(profile && profile.isDeleted),
      isSelf: targetID === currentUserID,
      joinedAtDisplay: user.createdAt.toLocaleString(),
      bio: profile ? profile.bio : null,
      followerCount, followingCount, blockedCount,
      friendCount: friends.length, friends,
      postCount, commentCount, likeGivenCount, bookmarkCount, repostCount,
      memberships, membershipCount: memberships.length,
      pendingReportCount, dismissedReportCount, pendingPostReportCount,
      hasPendingReports: pendingReportCount > 0,
      hasAnyReports: reportsAgainst.length > 0,
      chart
    });
  } catch (err) {
    res.status(500).send("Error loading user analytics: " + err.message);
  }
};
