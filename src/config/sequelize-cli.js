const { env } = require('./env');

module.exports = {
  development: {
    url: env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
  },
  test: {
    url: env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    url: env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: env.DB_SSL ? { require: true, rejectUnauthorized: false } : false,
    },
  },
};
