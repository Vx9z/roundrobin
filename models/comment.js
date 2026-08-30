const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Post = require("./post");

const Comment = sequelize.define("Comment", {
  postID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  authorID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  content: DataTypes.TEXT,
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    primaryKey: true
  }
}, {
  tableName: "comments",
  timestamps: false,
  id: false
});

Post.hasMany(Comment, { foreignKey: "postID", as: "Comments" });
Comment.belongsTo(Post, { foreignKey: "postID" });
User.hasMany(Comment, { foreignKey: "authorID", as: "Comments" });
Comment.belongsTo(User, { foreignKey: "authorID", as: "Author" });

module.exports = Comment;
