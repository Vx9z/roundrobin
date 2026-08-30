const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

// entityType is one of: 'post' | 'user' | 'community'.
// entityID is polymorphic and intentionally has no FK -- it points at
// posts.postID, users.userID or communities.communityID depending on
// entityType, exactly like notifications.entityID.
// status: 'pending' (needs attention) | 'dismissed' (reviewed, kept for history)
const Report = sequelize.define("Report", {
  reportID: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  reporterID: {
    type: DataTypes.UUID,
    allowNull: false
  },
  entityType: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  entityID: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "pending"
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "reports",
  timestamps: false
});

Report.belongsTo(User, { foreignKey: "reporterID", as: "Reporter" });

module.exports = Report;
