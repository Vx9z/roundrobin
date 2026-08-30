const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const UserProfile = sequelize.define("UserProfile", {
  userID: {
    type: DataTypes.UUID,
    primaryKey: true,
    references: { model: User, key: "userID" },
    onDelete: "CASCADE"
  },
  bio: DataTypes.TEXT,
  avatarURL: DataTypes.TEXT,
  bannerURL: DataTypes.TEXT,
  themeID: { type: DataTypes.INTEGER, defaultValue: 0 },
  privacyLevel: { type: DataTypes.STRING, defaultValue: "public" },
  notificationEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  isDeleted: DataTypes.BOOLEAN,
  deletedAt: DataTypes.DATE,
  lastArchive: DataTypes.DATE
}, {
  tableName: "userProfile",
  timestamps: false
});

// Associations
User.hasOne(UserProfile, { foreignKey: "userID", as: "Profile" });
UserProfile.belongsTo(User, { foreignKey: "userID" });

module.exports = UserProfile;
