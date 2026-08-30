const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Post = require("./post");

const Bookmark = sequelize.define("Bookmark", {
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
  tableName: "bookmarks",
  timestamps: false,
  id: false
});

Bookmark.belongsTo(User, { foreignKey: "userID" });
Bookmark.belongsTo(Post, { foreignKey: "postID" });
Post.hasMany(Bookmark, { foreignKey: "postID", as: "Bookmarks" });

module.exports = Bookmark;
