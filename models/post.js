const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const Post = sequelize.define("Post", {
  postID: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  authorID: {
    type: DataTypes.UUID,
    allowNull: false
  },
  communityID: {
    type: DataTypes.UUID,
    allowNull: true
  },
  content: DataTypes.TEXT,
  mediaURL: DataTypes.TEXT,
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "posts",
  timestamps: false
});

User.hasMany(Post, { foreignKey: "authorID", as: "Posts" });
Post.belongsTo(User, { foreignKey: "authorID", as: "Author" });

module.exports = Post;
