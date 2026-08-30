const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

// type is "dm" (exactly 2 participants, name null, dmKey set) or
// "group" (2+ participants, name required, dmKey null).
const Conversation = sequelize.define("Conversation", {
  conversationID: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  dmKey: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "conversations",
  timestamps: false
});

Conversation.belongsTo(User, { foreignKey: "createdBy", as: "Creator" });

module.exports = Conversation;
