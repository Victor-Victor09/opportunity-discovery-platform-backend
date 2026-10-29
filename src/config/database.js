import { Sequelize } from 'sequelize';
import { env, logger } from './env.js';

const sequelize = env.DATABASE_URL
  ? new Sequelize(env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: env.DB_SSL
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : {},
      define: {
        underscored: true,
        timestamps: true,
      },
    })
  : null;

export async function connectDatabase() {
  if (!sequelize) {
    throw new Error('DATABASE_URL is not set.');
  }

    await sequelize.authenticate();
    logger.info('Database connection established.');
}

export { sequelize };
