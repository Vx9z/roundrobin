const User = require("../models/user");
const UserProfile = require("../models/userProfile");
const { getCurrentUserID } = require("../middleware/auth");
const { THEMES, DEFAULT_THEME, isValidThemeID } = require("../config/themes");
const { avatarURLFor } = require("../config/avatar");

exports.editProfile = async (req, res) => {
  const currentUserID = getCurrentUserID(req);
  if (!currentUserID) return res.redirect("/login");

  if (currentUserID !== req.params.id) return res.redirect(`/profile/${req.params.id}`);

  const user = await User.findByPk(currentUserID, {
    include: [{ model: UserProfile, as: "Profile" }]
  });
  if (!user) return res.redirect("/search");

  // Matches themeNameFor's own fallback (config/themes.js) -- a user with no
  // themeID stored isn't necessarily "on theme 0", they're on whatever the
  // site default actually resolves to, which is DEFAULT_THEME, not a
  // hardcoded id. Otherwise this dropdown would show "Light" selected for
  // someone who is actually seeing vscode-dark.
  const activeThemeID = user.Profile?.themeID ?? DEFAULT_THEME.id;

  res.render("user/editProfile", {
    title: "Edit Profile",
    userID: user.userID,
    username: user.username,
    email: user.email,
    bio: user.Profile?.bio,
    avatarURL: avatarURLFor(user.Profile?.avatarURL),
    hasCustomAvatar: !!user.Profile?.avatarURL,
    bannerURL: user.Profile?.bannerURL,
    backgroundURL: user.Profile?.backgroundURL,
    // Handlebars has no equality helper (app.js registers only isVideoURL),
    // so the selected flag is resolved here rather than in the template.
    themes: THEMES.map(t => ({ ...t, selected: t.id === activeThemeID }))
  });
};

exports.updateProfile = async (req, res) => {
  try {
    const currentUserID = getCurrentUserID(req);
    if (!currentUserID) return res.redirect("/login");

    const { username, email, bio, themeID, removeAvatar, removeBanner, removeBackground } = req.body;

    // BUG FIX: the payload is built CONDITIONALLY. The previous version always
    // sent avatarURL/bannerURL and let them default to null when no file was
    // attached, so any save that did not re-upload a picture wrote NULL over
    // the stored URL and silently wiped it. A field that was not re-uploaded
    // this request must not appear in the payload at all.
    const payload = { bio };

    if (isValidThemeID(themeID)) payload.themeID = Number(themeID);

    // A newly-uploaded file always wins over a stale checked "remove" box.
    // Removing here only clears the DB pointer, not the file on disk --
    // same precedent as deletePost, which never cleans up /uploads either.
    if (req.files?.avatar?.[0]) payload.avatarURL = "/uploads/" + req.files.avatar[0].filename;
    else if (removeAvatar) payload.avatarURL = null;

    if (req.files?.banner?.[0]) payload.bannerURL = "/uploads/" + req.files.banner[0].filename;
    else if (removeBanner) payload.bannerURL = null;

    if (req.files?.background?.[0]) payload.backgroundURL = "/uploads/" + req.files.background[0].filename;
    else if (removeBackground) payload.backgroundURL = null;

    // Update Users table for identity
    await User.update({ username, email }, { where: { userID: currentUserID } });

    // findOrCreate + instance.update instead of upsert. upsert() rebuilds the
    // whole model instance, which drags every column that has a defaultValue
    // (themeID, privacyLevel, notificationEnabled) into the write -- so an
    // upsert could reset a suspended/private account's flags as a side effect
    // of editing a bio. instance.update() writes only the keys handed to it.
    const [profile] = await UserProfile.findOrCreate({
      where: { userID: currentUserID },
      defaults: { userID: currentUserID }
    });
    await profile.update(payload);

    res.redirect(`/profile/${currentUserID}`);
  } catch (err) {
    res.status(500).send("Error updating profile: " + err.message);
  }
};
