const Reaction = require("../models/reaction");
const Post = require("../models/post");
const { requireAuthOrXhr } = require("../middleware/auth");
const { createNotification } = require("./notificationController");

exports.toggleLike = async (req, res) => {
  try {
    const currentUserID = requireAuthOrXhr(req, res);
    if (!currentUserID) return;

    const existing = await Reaction.findOne({
      where: { postID: req.params.id, userID: currentUserID, type: "like" }
    });
    if (existing) {
      await existing.destroy();
    } else {
      await Reaction.create({ postID: req.params.id, userID: currentUserID, type: "like" });
      const post = await Post.findByPk(req.params.id);
      if (post) await createNotification({
        recipientID: post.authorID, actorID: currentUserID,
        type: "like", entityType: "post", entityID: post.postID
      });
    }

    if (req.xhr) {
      const likeCount = await Reaction.count({ where: { postID: req.params.id, type: "like" } });
      return res.json({ isLiked: !existing, likeCount });
    }
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error toggling like: " + err.message);
  }
};
