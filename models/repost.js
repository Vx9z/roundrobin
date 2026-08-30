const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Post = require("./post");

const Repost = sequelize.define("Repost", {
  userID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  postID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "reposts",
  timestamps: false,
  id: false
});

Repost.belongsTo(User, { foreignKey: "userID" });
Repost.belongsTo(Post, { foreignKey: "postID" });
Post.hasMany(Repost, { foreignKey: "postID", as: "Reposts" });

module.exports = Repost;
