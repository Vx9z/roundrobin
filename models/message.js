const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Conversation = require("./conversation");

const Message = sequelize.define("Message", {
  messageID: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  conversationID: {
    type: DataTypes.UUID,
    allowNull: false
  },
  senderID: {
    type: DataTypes.UUID,
    allowNull: true // SET NULL on user delete; renders as "[deleted]"
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "messages",
  timestamps: false
});

Message.belongsTo(User, { foreignKey: "senderID", as: "Sender" });
Message.belongsTo(Conversation, { foreignKey: "conversationID" });

module.exports = Message;
