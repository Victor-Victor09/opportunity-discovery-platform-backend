import dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: toNumber(process.env.PORT, 5000),
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_SSL: String(process.env.DB_SSL || 'false').toLowerCase() === 'true',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || '*',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

const allowedEnvironments = ['development', 'test', 'production'];
if (!allowedEnvironments.includes(env.NODE_ENV)) {
  throw new Error(`Invalid NODE_ENV: ${env.NODE_ENV}`);
}

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}
if (!env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required.');
}
if (env.NODE_ENV === 'production' && env.CLIENT_URL === '*') {
  throw new Error('CLIENT_URL must be explicitly configured in production.');
}


export const logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
