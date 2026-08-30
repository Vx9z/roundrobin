const User = require("../models/user");
const UserProfile = require("../models/userProfile");
const { getCurrentUserID } = require("../middleware/auth");

exports.editProfile = async (req, res) => {
  const currentUserID = getCurrentUserID(req);
  if (!currentUserID) return res.redirect("/login");

  if (currentUserID !== req.params.id) return res.redirect(`/profile/${req.params.id}`);

  const user = await User.findByPk(currentUserID, {
    include: [{ model: UserProfile, as: "Profile" }]
  });
  if (!user) return res.redirect("/search");

  res.render("user/editProfile", {
    title: "Edit Profile",
    userID: user.userID,
    username: user.username,
    email: user.email,
    bio: user.Profile?.bio,
    avatarURL: user.Profile?.avatarURL,
    bannerURL: user.Profile?.bannerURL
  });
};

exports.updateProfile = async (req, res) => {
  const currentUserID = getCurrentUserID(req);
  if (!currentUserID) return res.redirect("/login");

  const { username, email, bio } = req.body;
  let avatarURL = null;
  let bannerURL = null;

  if (req.files?.avatar) {
    avatarURL = "/uploads/" + req.files.avatar[0].filename;
  }
  if (req.files?.banner) {
    bannerURL = "/uploads/" + req.files.banner[0].filename;
  }

  // Update Users table for identity
  await User.update({ username, email }, { where: { userID: currentUserID } });

  // Update or insert into userProfile for personalization
  await UserProfile.upsert({
    userID: currentUserID,
    bio,
    avatarURL,
    bannerURL
  });

  res.redirect(`/profile/${currentUserID}`);
};
