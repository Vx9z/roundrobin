const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

// type is one of:
//   follow, like, comment, repost                -> entityType 'user' | 'post'
//   community_join, community_promoted,
//   community_demoted, community_removed,
//   community_banned, community_deleted          -> entityType 'community'
//   post_removed                                 -> entityType 'post'
//   account_suspended                            -> entityType null (system, actorID null)
const Notification = sequelize.define("Notification", {
  notificationID: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  recipientID: {
    type: DataTypes.UUID,
    allowNull: false
  },
  actorID: {
    type: DataTypes.UUID,
    allowNull: true
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  entityType: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  entityID: {
    type: DataTypes.UUID,
    allowNull: true
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "notifications",
  timestamps: false
});

Notification.belongsTo(User, { foreignKey: "actorID", as: "Actor" });

module.exports = Notification;
