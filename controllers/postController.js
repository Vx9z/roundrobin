const { Op } = require("sequelize");
const Post = require("../models/post");
const User = require("../models/user");
const Comment = require("../models/comment");
const Reaction = require("../models/reaction");
const Bookmark = require("../models/bookmark");
const Repost = require("../models/repost");
const UserRelationship = require("../models/userRelationships");
const CommunityMember = require("../models/communityMember");
const { getCurrentUserID } = require("../middleware/auth");

async function hydratePost(post, currentUserID) {
  const author = await User.findByPk(post.authorID);

  const comments = await Comment.findAll({
    where: { postID: post.postID },
    order: [["createdAt", "ASC"]]
  });
  const commentAuthorIDs = [...new Set(comments.map(c => c.authorID))];
  const commentAuthors = commentAuthorIDs.length
    ? await User.findAll({ where: { userID: commentAuthorIDs } })
    : [];
  const authorMap = Object.fromEntries(commentAuthors.map(u => [u.userID, u.username]));

  const likeCount = await Reaction.count({ where: { postID: post.postID, type: "like" } });
  const isLiked = !!(await Reaction.findOne({ where: { postID: post.postID, userID: currentUserID, type: "like" } }));
  const isBookmarked = !!(await Bookmark.findOne({ where: { postID: post.postID, userID: currentUserID } }));
  const isReposted = !!(await Repost.findOne({ where: { postID: post.postID, userID: currentUserID } }));

  return {
    postID: post.postID,
    content: post.content,
    mediaURL: post.mediaURL,
    createdAtDisplay: post.createdAt.toLocaleString(),
    authorID: post.authorID,
    authorUsername: author ? author.username : "[deleted]",
    isOwnPost: post.authorID === currentUserID,
    likeCount,
    isLiked,
    isBookmarked,
    isReposted,
    comments: comments.map(c => ({
      authorID: c.authorID,
      authorUsername: authorMap[c.authorID] || "[deleted]",
      content: c.content,
      createdAtDisplay: c.createdAt.toLocaleString(),
      createdAtISO: c.createdAt.toISOString(),
      isOwnComment: c.authorID === currentUserID
    }))
  };
}
exports.hydratePost = hydratePost;

// Own posts + posts from users this account follows + posts from communities
// this account is an active member of, newest first. No ranking/algorithm.
exports.getFeedPosts = async (currentUserID) => {
  const followedRels = await UserRelationship.findAll({
    where: { followerID: currentUserID, type: "follow" },
    attributes: ["followingID"]
  });
  const authorIDs = [...followedRels.map(r => r.followingID), currentUserID];

  const memberships = await CommunityMember.findAll({
    where: { userID: currentUserID, status: "active" },
    attributes: ["communityID"]
  });
  const communityIDs = memberships.map(m => m.communityID);

  const posts = await Post.findAll({
    where: { [Op.or]: [{ authorID: authorIDs }, { communityID: communityIDs }] },
    order: [["createdAt", "DESC"]]
  });

  return Promise.all(posts.map(p => hydratePost(p, currentUserID)));
};

// A profile's own posts merged with posts they reposted, sorted by the relevant timestamp.
exports.getProfilePosts = async (profileUserID, currentUserID) => {
  const ownPosts = await Post.findAll({ where: { authorID: profileUserID } });
  const reposts = await Repost.findAll({
    where: { userID: profileUserID },
    include: [{ model: Post }]
  });
  const reposter = await User.findByPk(profileUserID);

  const ownEntries = await Promise.all(ownPosts.map(async p => ({
    ...(await hydratePost(p, currentUserID)),
    sortDate: p.createdAt
  })));

  const repostEntries = await Promise.all(reposts.map(async r => ({
    ...(await hydratePost(r.Post, currentUserID)),
    repostedByUsername: reposter ? reposter.username : null,
    sortDate: r.createdAt
  })));

  return [...ownEntries, ...repostEntries].sort((a, b) => b.sortDate - a.sortDate);
};

exports.getBookmarkedPosts = async (currentUserID) => {
  const bookmarks = await Bookmark.findAll({
    where: { userID: currentUserID },
    include: [{ model: Post }],
    order: [["createdAt", "DESC"]]
  });
  return Promise.all(bookmarks.map(b => hydratePost(b.Post, currentUserID)));
};

exports.showFeed = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const posts = await exports.getFeedPosts(currentUserID);
    res.render("feed", { title: "Home Feed", currentUserID, returnTo: "/feed", posts });
  } catch (err) {
    res.status(500).send("Error loading feed: " + err.message);
  }
};

exports.createPost = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { content, communityID } = req.body;
    const mediaURL = req.file ? "/uploads/" + req.file.filename : null;
    const returnTo = communityID ? `/communities/${communityID}` : "/feed";
    if (!content && !mediaURL) return res.redirect(returnTo);

    // Posting into a community requires an active (non-banned) membership.
    if (communityID) {
      const membership = await CommunityMember.findOne({
        where: { communityID, userID: currentUserID, status: "active" }
      });
      if (!membership) return res.redirect(returnTo);
    }

    await Post.create({ authorID: currentUserID, content, mediaURL, communityID: communityID || null });
    res.redirect(returnTo);
  } catch (err) {
    res.status(500).send("Error creating post: " + err.message);
  }
};

exports.deletePost = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    await Post.destroy({ where: { postID: req.params.id, authorID: currentUserID } });
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error deleting post: " + err.message);
  }
};

// Posts from users you don't already follow and haven't blocked (either
// direction), from the last few days, ranked by likes + comments computed
// fresh -- no stored score, no new tables.
exports.getSuggestedPosts = async (currentUserID) => {
  const followed = await UserRelationship.findAll({ where: { followerID: currentUserID, type: "follow" }, attributes: ["followingID"] });
  const blocksOut = await UserRelationship.findAll({ where: { followerID: currentUserID, type: "block" }, attributes: ["followingID"] });
  const blocksIn = await UserRelationship.findAll({ where: { followingID: currentUserID, type: "block" }, attributes: ["followerID"] });

  const excludedIDs = [
    currentUserID,
    ...followed.map(r => r.followingID),
    ...blocksOut.map(r => r.followingID),
    ...blocksIn.map(r => r.followerID)
  ];

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // last 3 days

  const candidates = await Post.findAll({
    where: { authorID: { [Op.notIn]: excludedIDs }, createdAt: { [Op.gte]: since } },
    order: [["createdAt", "DESC"]],
    limit: 50
  });

  const scored = await Promise.all(candidates.map(async p => ({
    post: p,
    score: (await Reaction.count({ where: { postID: p.postID, type: "like" } }))
         + (await Comment.count({ where: { postID: p.postID } }))
  })));

  scored.sort((a, b) => b.score - a.score);
  return Promise.all(scored.slice(0, 15).map(s => hydratePost(s.post, currentUserID)));
};

exports.showSuggested = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const posts = await exports.getSuggestedPosts(currentUserID);
    res.render("suggested", { title: "Suggested Posts", currentUserID, returnTo: "/suggested", posts });
  } catch (err) {
    res.status(500).send("Error loading suggested posts: " + err.message);
  }
};
