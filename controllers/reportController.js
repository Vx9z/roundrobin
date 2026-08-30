const Post = require("../models/post");
const User = require("../models/user");
const Community = require("../models/community");
const Report = require("../models/report");
const { getCurrentUserID } = require("../middleware/auth");

// One report per reporter per entity. The findOne is the ordinary path; the
// reports_reporter_entity_key constraint is the real guarantee under a
// double-submit, so a duplicate insert is swallowed as a silent no-op --
// the same "invalid/duplicate action -> silent redirect, no error page"
// behaviour joinCommunity has for an existing membership.
async function submitReport(entityType, entityID, reporterID) {
  const existing = await Report.findOne({ where: { reporterID, entityType, entityID } });
  if (existing) return;
  try {
    await Report.create({ reporterID, entityType, entityID });
  } catch (err) {
    if (err.name !== "SequelizeUniqueConstraintError") throw err;
  }
}

// Precomputed for the views, exactly like isLiked / isBookmarked. This
// deliberately ignores status: a dismissed report still occupies the unique
// slot, so the button must stay inert rather than lie about being clickable.
exports.hasReported = async (reporterID, entityType, entityID) => {
  return !!(await Report.findOne({ where: { reporterID, entityType, entityID } }));
};

// Reporting intentionally sends NO notification: the reported party must not
// be told, and moderators find reports on their dashboard rather than in
// their notification list.
exports.reportPost = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const returnTo = req.body.returnTo || "/feed";
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.redirect(returnTo);
    if (post.authorID === currentUserID) return res.redirect(returnTo); // no self-report

    await submitReport("post", post.postID, currentUserID);
    res.redirect(returnTo);
  } catch (err) {
    res.status(500).send("Error reporting post: " + err.message);
  }
};

exports.reportUser = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const targetID = req.params.id;
    if (targetID === currentUserID) return res.redirect(`/profile/${targetID}`); // no self-report

    const target = await User.findByPk(targetID);
    if (!target) return res.redirect("/search");

    await submitReport("user", target.userID, currentUserID);
    res.redirect(`/profile/${target.userID}`);
  } catch (err) {
    res.status(500).send("Error reporting user: " + err.message);
  }
};

// No self-check here: reporting a community you belong to is a normal thing
// to do, and a community has no single "owner" to exempt.
exports.reportCommunity = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const community = await Community.findByPk(req.params.id);
    if (!community) return res.redirect("/communities");

    await submitReport("community", community.communityID, currentUserID);
    res.redirect(`/communities/${community.communityID}`);
  } catch (err) {
    res.status(500).send("Error reporting community: " + err.message);
  }
};
