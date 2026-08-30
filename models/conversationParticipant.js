const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Conversation = require("./conversation");

const ConversationParticipant = sequelize.define("ConversationParticipant", {
  conversationID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  userID: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "conversationParticipants",
  timestamps: false,
  id: false
});

ConversationParticipant.belongsTo(User, { foreignKey: "userID" });
ConversationParticipant.belongsTo(Conversation, { foreignKey: "conversationID" });

module.exports = ConversationParticipant;
