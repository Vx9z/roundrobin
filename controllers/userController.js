const User = require("../models/user");
const UserRelationship = require("../models/userRelationships");
const { getCurrentUserID } = require("../middleware/auth");
const { getProfilePosts } = require("./postController");
const { createNotification } = require("./notificationController");

exports.searchUsers = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    // Fetch all users
    const users = await User.findAll();

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
    let friendsList = [];
    if (currentUserID === user.userID) {
      const friends = await UserRelationship.findAll({
        where: { followerID: currentUserID, type: "follow" },
        include: [{ model: User, as: "FollowingUser", attributes: ["userID", "username"] }]
      });

      // Filter only mutual follows
      for (const rel of friends) {
        const backFollow = await UserRelationship.findOne({
          where: { followerID: rel.followingID, followingID: currentUserID, type: "follow" }
        });
        if (backFollow) {
          friendsList.push(rel.FollowingUser.get({ plain: true }));
        }
      }
    }

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
