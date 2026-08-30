const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const Community = sequelize.define("Community", {
  communityID: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: DataTypes.TEXT,
  bannerURL: DataTypes.TEXT,
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  createdBy: DataTypes.UUID
}, {
  tableName: "communities",
  timestamps: false
});

Community.belongsTo(User, { foreignKey: "createdBy", as: "Creator" });

module.exports = Community;
