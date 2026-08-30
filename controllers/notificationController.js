const Notification = require("../models/notification");
const UserProfile = require("../models/userProfile");
const User = require("../models/user");
const { getCurrentUserID } = require("../middleware/auth");

// Best-effort: a notification failure must never break the action that caused it.
exports.createNotification = async ({ recipientID, actorID, type, entityType, entityID }) => {
  try {
    if (!recipientID) return;
    if (actorID && actorID === recipientID) return; // never notify yourself

    const profile = await UserProfile.findByPk(recipientID);
    if (profile && profile.notificationEnabled === false) return; // no profile row = notifications on

    await Notification.create({
      recipientID,
      actorID: actorID || null,
      type,
      entityType: entityType || null,
      entityID: entityID || null
    });
  } catch (err) {
    console.error("createNotification failed:", err.message);
  }
};

function notificationText(n) {
  const who = n.Actor ? n.Actor.username : "Someone";
  switch (n.type) {
    case "follow": return `${who} started following you`;
    case "like": return `${who} liked your post`;
    case "comment": return `${who} commented on your post`;
    case "repost": return `${who} reposted your post`;
    case "community_join": return `${who} joined a community you moderate`;
    case "community_promoted": return "You were made a moderator of a community";
    case "community_demoted": return "You are no longer a moderator of a community";
    case "community_removed": return "You were removed from a community (you may rejoin)";
    case "community_banned": return "You were banned from a community";
    case "community_deleted": return "A community you were in was deleted";
    case "post_removed": return "A moderator removed one of your posts";
    case "account_suspended": return "Your account was suspended by a moderator";
    default: return "You have a new notification";
  }
}

// This app has no single-post permalink page, so post-related notifications
// link to the recipient's own profile (which is guaranteed to show a post
// they authored) rather than the exact post.
function notificationLink(n, recipientID) {
  switch (n.type) {
    case "follow": return `/profile/${n.actorID}`;
    case "like":
    case "comment":
    case "repost":
    case "post_removed": return `/profile/${recipientID}`;
    case "community_deleted": return "/communities";
    case "community_join":
    case "community_promoted":
    case "community_demoted":
    case "community_removed":
    case "community_banned": return `/communities/${n.entityID}`;
    default: return "/feed";
  }
}

exports.showNotifications = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const notifications = await Notification.findAll({
      where: { recipientID: currentUserID },
      include: [{ model: User, as: "Actor", attributes: ["userID", "username"] }],
      order: [["createdAt", "DESC"]],
      limit: 50
    });

    const items = notifications.map(n => ({
      notificationID: n.notificationID,
      isRead: n.isRead,
      createdAtDisplay: n.createdAt.toLocaleString(),
      text: notificationText(n)
    }));

    res.render("notifications", { title: "Notifications", currentUserID, returnTo: "/notifications", items });
  } catch (err) {
    res.status(500).send("Error loading notifications: " + err.message);
  }
};

exports.markRead = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const notification = await Notification.findOne({
      where: { notificationID: req.params.id, recipientID: currentUserID }
    });
    if (!notification) return res.redirect("/notifications");

    await notification.update({ isRead: true });
    res.redirect(notificationLink(notification, currentUserID));
  } catch (err) {
    res.status(500).send("Error marking notification read: " + err.message);
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    await Notification.update(
      { isRead: true },
      { where: { recipientID: currentUserID, isRead: false } }
    );
    res.redirect("/notifications");
  } catch (err) {
    res.status(500).send("Error marking all notifications read: " + err.message);
  }
};
