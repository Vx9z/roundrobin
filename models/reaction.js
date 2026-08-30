const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Post = require("./post");

const Reaction = sequelize.define("Reaction", {
  postID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  userID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    primaryKey: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "reactions",
  timestamps: false,
  id: false
});

Post.hasMany(Reaction, { foreignKey: "postID", as: "Reactions" });
Reaction.belongsTo(Post, { foreignKey: "postID" });
Reaction.belongsTo(User, { foreignKey: "userID" });

module.exports = Reaction;
