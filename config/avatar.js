// Resolved server-side wherever an avatar is displayed, so templates always
// get a real URL and never need an {{#if avatarURL}} branch just to decide
// what to show.
const DEFAULT_AVATAR_URL = "/images/blank-avatar.png";

function avatarURLFor(rawAvatarURL) {
  return rawAvatarURL || DEFAULT_AVATAR_URL;
}

module.exports = { DEFAULT_AVATAR_URL, avatarURLFor };
