const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user"); // import User model

const UserRelationships = sequelize.define("UserRelationships", {
  followerID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  followingID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false, // "follow" or "block"
    primaryKey: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "userRelationships",
  timestamps: false,
  id: false
});

// ✅ Define associations
UserRelationships.belongsTo(User, { as: "FollowerUser", foreignKey: "followerID" });
UserRelationships.belongsTo(User, { as: "FollowingUser", foreignKey: "followingID" });

module.exports = UserRelationships;
