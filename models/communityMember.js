const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Community = require("./community");

const CommunityMember = sequelize.define("CommunityMember", {
  communityID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  userID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "member" // "member" | "moderator"
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "active" // "active" | "banned"
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "communityMembers",
  timestamps: false,
  id: false
});

CommunityMember.belongsTo(User, { foreignKey: "userID" });
CommunityMember.belongsTo(Community, { foreignKey: "communityID" });

module.exports = CommunityMember;
