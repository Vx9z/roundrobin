const Comment = require("../models/comment");
const Post = require("../models/post");
const { getCurrentUserID } = require("../middleware/auth");
const { createNotification } = require("./notificationController");

exports.createComment = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { content } = req.body;
    if (content && content.trim()) {
      await Comment.create({ postID: req.params.id, authorID: currentUserID, content });
      const post = await Post.findByPk(req.params.id);
      if (post) await createNotification({
        recipientID: post.authorID, actorID: currentUserID,
        type: "comment", entityType: "post", entityID: post.postID
      });
    }
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error posting comment: " + err.message);
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    await Comment.destroy({
      where: { postID: req.params.id, authorID: currentUserID, createdAt: new Date(req.body.createdAt) }
    });
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error deleting comment: " + err.message);
  }
};
