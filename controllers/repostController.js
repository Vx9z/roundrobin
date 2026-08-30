const Repost = require("../models/repost");
const Post = require("../models/post");
const { getCurrentUserID } = require("../middleware/auth");
const { createNotification } = require("./notificationController");

exports.toggleRepost = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

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
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error toggling repost: " + err.message);
  }
};
