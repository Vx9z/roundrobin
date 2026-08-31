const Community = require("../models/community");
const CommunityMember = require("../models/communityMember");
const Post = require("../models/post");
const { getCurrentUserID } = require("../middleware/auth");
const { isCommunityMod } = require("../middleware/permissions");
const { createNotification } = require("./notificationController");
const { hydratePost } = require("./postController");
const { hasReported } = require("./reportController");
const { CODE_LANGUAGES } = require("../config/codeLanguages");

exports.listCommunities = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const communities = await Community.findAll({ order: [["name", "ASC"]] });
    const communityRows = await Promise.all(communities.map(async c => {
      const memberCount = await CommunityMember.count({ where: { communityID: c.communityID, status: "active" } });
      const membership = await CommunityMember.findOne({ where: { communityID: c.communityID, userID: currentUserID } });
      return {
        communityID: c.communityID,
        name: c.name,
        description: c.description,
        memberCount,
        isMember: !!membership && membership.status === "active",
        isBanned: !!membership && membership.status === "banned"
      };
    }));

    const myMemberships = await CommunityMember.findAll({
      where: { userID: currentUserID, status: "active" },
      include: [{ model: Community }]
    });
    const myCommunities = myMemberships.map(m => ({ communityID: m.Community.communityID, name: m.Community.name }));

    res.render("community/list", { title: "Communities", currentUserID, communities: communityRows, myCommunities });
  } catch (err) {
    res.status(500).send("Error loading communities: " + err.message);
  }
};

exports.showCreateForm = (req, res) => {
  const currentUserID = getCurrentUserID(req);
  if (!currentUserID) return res.redirect("/login");
  res.render("community/new", { title: "Create Community", currentUserID });
};

exports.createCommunity = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.render("community/new", { title: "Create Community", currentUserID, error: "Name is required" });
    }

    const existing = await Community.findOne({ where: { name } });
    if (existing) {
      return res.render("community/new", { title: "Create Community", currentUserID, error: "That name is already taken" });
    }

    const bannerURL = req.file ? "/uploads/" + req.file.filename : null;
    const community = await Community.create({ name, description, bannerURL, createdBy: currentUserID });
    await CommunityMember.create({ communityID: community.communityID, userID: currentUserID, role: "moderator", status: "active" });

    res.redirect(`/communities/${community.communityID}`);
  } catch (err) {
    res.status(500).send("Error creating community: " + err.message);
  }
};

exports.showCommunity = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const community = await Community.findByPk(req.params.id);
    if (!community) return res.redirect("/communities");

    const memberCount = await CommunityMember.count({ where: { communityID: community.communityID, status: "active" } });
    const membership = await CommunityMember.findOne({ where: { communityID: community.communityID, userID: currentUserID } });
    const isMember = !!membership && membership.status === "active";
    const isBanned = !!membership && membership.status === "banned";
    const isMod = await isCommunityMod(currentUserID, community.communityID);
    const isReportedByMe = await hasReported(currentUserID, "community", community.communityID);

    const rawPosts = await Post.findAll({ where: { communityID: community.communityID }, order: [["createdAt", "DESC"]] });
    const posts = await Promise.all(rawPosts.map(p => hydratePost(p, currentUserID)));

    res.render("community/board", {
      title: community.name,
      currentUserID,
      communityID: community.communityID,
      name: community.name,
      description: community.description,
      bannerURL: community.bannerURL,
      memberCount,
      isMember,
      isBanned,
      isMod,
      isReportedByMe,
      returnTo: `/communities/${community.communityID}`,
      posts,
      codeLanguages: CODE_LANGUAGES
    });
  } catch (err) {
    res.status(500).send("Error loading community: " + err.message);
  }
};

exports.joinCommunity = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const communityID = req.params.id;
    const existing = await CommunityMember.findOne({ where: { communityID, userID: currentUserID } });

    if (!existing) {
      await CommunityMember.create({ communityID, userID: currentUserID, role: "member", status: "active" });

      const moderators = await CommunityMember.findAll({ where: { communityID, role: "moderator", status: "active" } });
      for (const mod of moderators) {
        await createNotification({
          recipientID: mod.userID, actorID: currentUserID,
          type: "community_join", entityType: "community", entityID: communityID
        });
      }
    }
    // existing active or banned membership: no-op either way

    res.redirect(`/communities/${communityID}`);
  } catch (err) {
    res.status(500).send("Error joining community: " + err.message);
  }
};

exports.leaveCommunity = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    await CommunityMember.destroy({
      where: { communityID: req.params.id, userID: currentUserID, status: "active" }
    });
    res.redirect(`/communities/${req.params.id}`);
  } catch (err) {
    res.status(500).send("Error leaving community: " + err.message);
  }
};
