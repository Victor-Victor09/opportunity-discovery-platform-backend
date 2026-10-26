const app = require('./app');
const { env } = require('./config/env');
const { default: logger } = require('./utils/logger');

const port = env.PORT || 3000;

const server = app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});

const shutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully.`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
