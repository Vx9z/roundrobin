const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserRelationships = sequelize.define("UserRelationships", {
  followerID: {
    type: DataTypes.UUID,
    allowNull: false
  },
  followingID: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "userRelationships",
  timestamps: false
});

module.exports = UserRelationships;
