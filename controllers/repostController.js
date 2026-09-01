const Repost = require("../models/repost");
const Post = require("../models/post");
const { requireAuthOrXhr } = require("../middleware/auth");
const { createNotification } = require("./notificationController");

exports.toggleRepost = async (req, res) => {
  try {
    const currentUserID = requireAuthOrXhr(req, res);
    if (!currentUserID) return;

    const existing = await Repost.findOne({ where: { postID: req.params.id, userID: currentUserID } });
    if (existing) {
      await existing.destroy();
    } else {
      await Repost.create({ postID: req.params.id, userID: currentUserID });
      const post = await Post.findByPk(req.params.id);
      if (post) await createNotification({
        recipientID: post.authorID, actorID: currentUserID,
        type: "repost", entityType: "post", entityID: post.postID
      });
    }

    if (req.xhr) return res.json({ isReposted: !existing });
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error toggling repost: " + err.message);
  }
};
