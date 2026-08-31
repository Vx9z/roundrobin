const User = require("../models/user");
const UserRelationship = require("../models/userRelationships");
const { getCurrentUserID } = require("../middleware/auth");
const { getProfilePosts } = require("./postController");
const { createNotification } = require("./notificationController");
const { hasReported } = require("./reportController");
const { AI_BOT_USER_ID } = require("../config/ollama");

// Mutual follows ("friends"): people this user follows who follow back.
// Returns plain objects [{ userID, username }].
async function getFriends(userID) {
  const following = await UserRelationship.findAll({
    where: { followerID: userID, type: "follow" },
    include: [{ model: User, as: "FollowingUser", attributes: ["userID", "username"] }]
  });

  const friends = [];
  for (const rel of following) {
    const backFollow = await UserRelationship.findOne({
      where: { followerID: rel.followingID, followingID: userID, type: "follow" }
    });
    if (backFollow) friends.push(rel.FollowingUser.get({ plain: true }));
  }
  return friends;
}
exports.getFriends = getFriends;

async function areMutualFollows(userA, userB) {
  const forward = await UserRelationship.findOne({
    where: { followerID: userA, followingID: userB, type: "follow" }
  });
  if (!forward) return false;
  const back = await UserRelationship.findOne({
    where: { followerID: userB, followingID: userA, type: "follow" }
  });
  return !!back;
}
exports.areMutualFollows = areMutualFollows;

exports.searchUsers = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    // Fetch all users (excluding the AI bot -- it's reached via the "AI Chat" nav link, not search)
    const users = (await User.findAll()).filter(u => u.userID !== AI_BOT_USER_ID);

    // Convert Sequelize instances to plain objects
    const plainUsers = users.map(u => u.get({ plain: true }));

    res.render("user/search", { 
      title: "Search Users", 
      users: plainUsers,   // ✅ now Handlebars can iterate
      currentUserID
    });
  } catch (err) {
    res.status(500).send("Error fetching users: " + err.message);
  }
};


exports.viewProfile = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect("/search");

    // Check if profile owner blocked current user
    const blocked = await UserRelationship.findOne({
      where: { followerID: user.userID, followingID: currentUserID, type: "block" }
    });

    // Check if current user follows this profile
    const following = await UserRelationship.findOne({
      where: { followerID: currentUserID, followingID: user.userID, type: "follow" }
    });

    // If viewing own profile, fetch friends (mutual follows)
    const friendsList = currentUserID === user.userID ? await getFriends(currentUserID) : [];

    const isReportedByMe = currentUserID === user.userID
      ? false
      : await hasReported(currentUserID, "user", user.userID);

    const posts = await getProfilePosts(user.userID, currentUserID);

    res.render("user/profile", {
      title: "User Profile",
      userID: user.userID,
      username: user.username,
      email: user.email,
      clearanceLevel: user.clearanceLevel,
      profileOwner: currentUserID === user.userID,
      isBlocked: !!blocked,
      isFollowing: !!following,
      isReportedByMe,
      friendsList,
      posts,
      returnTo: `/profile/${user.userID}`
    });
  } catch (err) {
    res.status(500).send("Error loading profile: " + err.message);
  }
};


exports.followUser = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    await UserRelationship.create({
      followerID: currentUserID,
      followingID: req.params.id,
      type: "follow"
    });
    await createNotification({
      recipientID: req.params.id, actorID: currentUserID,
      type: "follow", entityType: "user", entityID: currentUserID
    });
    res.redirect(`/profile/${req.params.id}`);
  } catch (err) {
    res.status(500).send("Error following user: " + err.message);
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    await UserRelationship.destroy({
      where: { followerID: currentUserID, followingID: req.params.id, type: "follow" }
    });
    res.redirect(`/profile/${req.params.id}`);
  } catch (err) {
    res.status(500).send("Error unfollowing user: " + err.message);
  }
};

exports.blockUser = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    await UserRelationship.create({
      followerID: currentUserID,
      followingID: req.params.id,
      type: "block"
    });
    res.redirect(`/profile/${req.params.id}`);
  } catch (err) {
    res.status(500).send("Error blocking user: " + err.message);
  }
};
