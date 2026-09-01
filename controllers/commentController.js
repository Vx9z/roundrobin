const Comment = require("../models/comment");
const Post = require("../models/post");
const User = require("../models/user");
const { requireAuthOrXhr } = require("../middleware/auth");
const { createNotification } = require("./notificationController");

exports.createComment = async (req, res) => {
  try {
    const currentUserID = requireAuthOrXhr(req, res);
    if (!currentUserID) return;

    const { content } = req.body;
    if (content && content.trim()) {
      const comment = await Comment.create({ postID: req.params.id, authorID: currentUserID, content });
      const post = await Post.findByPk(req.params.id);
      if (post) await createNotification({
        recipientID: post.authorID, actorID: currentUserID,
        type: "comment", entityType: "post", entityID: post.postID
      });

      if (req.xhr) {
        const author = await User.findByPk(currentUserID);
        return res.json({
          authorID: currentUserID,
          authorUsername: author ? author.username : "[deleted]",
          content: comment.content,
          createdAtISO: comment.createdAt.toISOString(),
          createdAtDisplay: comment.createdAt.toLocaleString()
        });
      }
    } else if (req.xhr) {
      return res.status(400).json({ error: "Comment cannot be empty" });
    }
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error posting comment: " + err.message);
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const currentUserID = requireAuthOrXhr(req, res);
    if (!currentUserID) return;

    const destroyedCount = await Comment.destroy({
      where: { postID: req.params.id, authorID: currentUserID, createdAt: new Date(req.body.createdAt) }
    });
    if (req.xhr) return res.json({ success: destroyedCount > 0 });
    res.redirect(req.body.returnTo || "/feed");
  } catch (err) {
    res.status(500).send("Error deleting comment: " + err.message);
  }
};
