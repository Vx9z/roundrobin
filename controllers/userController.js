const User = require("../models/user");
const UserRelationship = require("../models/userRelationships");
const jwt = require("jsonwebtoken");

function getCurrentUserID(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, "SECRET_KEY");
    return decoded.id;
  } catch {
    return null;
  }
}

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

    // Check if profile owner blocked the current user
    const blocked = await UserRelationship.findOne({
      where: { followerID: user.userID, followingID: currentUserID, type: "block" }
    });

    res.render("user/profile", {
      title: "User Profile",
      userID: user.userID,
      username: user.username,
      email: user.email,
      clearanceLevel: user.clearanceLevel,
      profileOwner: currentUserID === user.userID,
      isBlocked: !!blocked
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
