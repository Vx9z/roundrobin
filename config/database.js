const { Sequelize } = require("sequelize");

const sequelize = new Sequelize("roundrobin", "postgres", "V", {
    host: "localhost",
    dialect: "postgres",
});

module.exports = sequelize;
