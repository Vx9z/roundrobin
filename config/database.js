const { Sequelize } = require("sequelize");

const sequelize = new Sequelize("roundrobin", "postgres", "V", {
    host: "localhost",
    dialect: "postgres",
    quoteIdentifiers: false,
});

module.exports = sequelize;
