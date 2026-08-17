const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  userID: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(25),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: true // optional, since you want username login
  },
  passwordHash: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  clearanceLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "Users", // TABLE name
  timestamps: false    // we already defined createdAt/updatedAt manually
});

module.exports = User;
