const { Op } = require("sequelize");
const User = require("../models/user");
const UserProfile = require("../models/userProfile");
const CommunityMember = require("../models/communityMember");
const UserRelationship = require("../models/userRelationships");

async function isGeneralMod(userID) {
  const user = await User.findByPk(userID);
  return !!user && user.clearanceLevel >= 1;
}

// A community moderator, OR a general mod acting through the override.
// This one OR is what lets a general mod reuse every community-mod route.
async function isCommunityMod(userID, communityID) {
  const membership = await CommunityMember.findOne({
    where: { communityID, userID, role: "moderator", status: "active" }
  });
  if (membership) return true;
  return isGeneralMod(userID);
}

async function isActiveMember(userID, communityID) {
  const membership = await CommunityMember.findOne({
    where: { communityID, userID, status: "active" }
  });
  return !!membership;
}

async function isSuspended(userID) {
  const profile = await UserProfile.findByPk(userID);
  return !!(profile && profile.isDeleted);
}

// Blocking is one-directional in the data model but must be symmetric in
// effect: a blocked user must not be able to keep messaging the person who
// blocked them, and vice versa.
async function isBlockedBetween(userA, userB) {
  const block = await UserRelationship.findOne({
    where: {
      type: "block",
      [Op.or]: [
        { followerID: userA, followingID: userB },
        { followerID: userB, followingID: userA }
      ]
    }
  });
  return !!block;
}

module.exports = { isGeneralMod, isCommunityMod, isActiveMember, isSuspended, isBlockedBetween };
