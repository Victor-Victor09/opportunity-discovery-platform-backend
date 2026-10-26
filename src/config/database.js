const { Sequelize } = require('sequelize');
const { env } = require('./env');

const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: env.DB_SSL ? { require: true, rejectUnauthorized: false } : false,
  },
  define: {
    underscored: true,
    timestamps: true,
  },
});

module.exports = sequelize;
